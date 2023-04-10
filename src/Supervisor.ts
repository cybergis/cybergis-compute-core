import Queue from "./Queue";
import Emitter from "./Emitter";
import { Job } from "./models/Job";
import { SSH } from "./types";
import { config, maintainerConfigMap, hpcConfigMap } from "../configs/config";
import connectionPool from "./connectors/ConnectionPool";
import * as events from "events";
import DB from "./DB";
import NodeSSH = require("node-ssh");

class Supervisor {
  private db = new DB();

  private jobPoolCapacities: { [keys: string]: number } = {};

  private jobPoolCounters: { [keys: string]: number } = {};

  private queues: { [keys: string]: Queue } = {};

  private emitter = new Emitter();

  private maintainerMasterThread = null;

  private maintainerMasterEventEmitter = new events.EventEmitter();

  private queueConsumeTimePeriodInSeconds =
    config.queue_consume_time_period_in_seconds;

  constructor() {
    for (var hpcName in hpcConfigMap) {
      var hpcConfig = hpcConfigMap[hpcName];
      // register job pool & queues
      this.jobPoolCapacities[hpcName] = hpcConfig.job_pool_capacity;
      this.jobPoolCounters[hpcName] = 0;
      this.queues[hpcName] = new Queue(hpcName);
    }

    this.createMaintainerMaster();
  }

  createMaintainerMaster() {
    var self = this;

    // queue consumer
    this.maintainerMasterThread = setInterval(async () => {
      for (var hpcName in self.jobPoolCounters) {
        while (
          self.jobPoolCounters[hpcName] < self.jobPoolCapacities[hpcName] &&
          !(await self.queues[hpcName].isEmpty())
        ) {
          var job = await self.queues[hpcName].shift();
          if (!job) continue;
          var maintainer = require(`./maintainers/${
            maintainerConfigMap[job.maintainer].maintainer
          }`).default; // typescript compilation hack
          try {
            job.maintainerInstance = new maintainer(job);
          } catch (e) {
            // log error and skip job
            self.emitter.registerEvents(
              job,
              "JOB_INIT_ERROR",
              `job [${job.id}] failed to initialized with error ${e.toString()}`
            );
            job.finishedAt = new Date();
            var connection = await self.db.connect();
            await connection
              .createQueryBuilder()
              .update(Job)
              .where("id = :id", { id: job.id })
              .set({ finishedAt: job.finishedAt })
              .execute();
            continue;
          }
          self.jobPoolCounters[hpcName]++;

          // manage ssh pool
          if (job.maintainerInstance.connector.config.is_community_account) {
            connectionPool[job.hpc].counter++;
          } else {
            const hpcConfig = hpcConfigMap[job.hpc];
            connectionPool[job.id] = {
              counter: 1,
              ssh: {
                connection: new NodeSSH(),
                config: {
                  host: hpcConfig.ip,
                  port: hpcConfig.port,
                  username: job.credential.user,
                  password: job.credential.password,
                  readyTimeout: 1000,
                },
              },
            };
          }

          // emit event
          self.emitter.registerEvents(
            job,
            "JOB_REGISTERED",
            `job [${job.id}] is registered with the supervisor, waiting for initialization`
          );

          // run worker
          this.createMaintainerWorker(job);
        }
      }
    }, this.queueConsumeTimePeriodInSeconds * 1000);

    // remove job once ended
    this.maintainerMasterEventEmitter.on("job_end", (hpcName, jobName) => {
      if (config.is_testing)
        console.log(`received job_end event from ${jobName}`);
      self.jobPoolCounters[hpcName]--;
    });
  }

  async createMaintainerWorker(job: Job) {
    var self = this;

    while (true) {
      // get ssh connector from pool
      var ssh: SSH;
      if (job.maintainerInstance.connector.config.is_community_account) {
        ssh = connectionPool[job.hpc].ssh;
      } else {
        ssh = connectionPool[job.id].ssh;
      }

      // connect ssh & run
      try {
        if (!ssh.connection.isConnected())
          await ssh.connection.connect(ssh.config);
        await ssh.connection.execCommand("echo"); // test connection
        if (job.maintainerInstance.isInit) {
          await job.maintainerInstance.maintain();
        } else {
          await job.maintainerInstance.init();
        }
      } catch (e) {
        if (config.is_testing) console.error(e.stack);
        continue;
      }

      // emit events & logs
      var events = job.maintainerInstance.dumpEvents();
      var logs = job.maintainerInstance.dumpLogs();
      // TODO: no need to dump events or logs outside the maintainer
      for (var j in events)
        self.emitter.registerEvents(job, events[j].type, events[j].message);
      for (var j in logs) self.emitter.registerLogs(job, logs[j]);

      // ending conditions
      if (job.maintainerInstance.isEnd) {
        // exit or deflag ssh pool
        if (job.maintainerInstance.connector.config.is_community_account) {
          connectionPool[job.hpc].counter--;
          if (connectionPool[job.hpc].counter === 0) {
            if (ssh.connection.isConnected()) await ssh.connection.dispose();
          }
        } else {
          if (ssh.connection.isConnected()) await ssh.connection.dispose();
          delete connectionPool[job.id];
        }

        // emit event
        this.maintainerMasterEventEmitter.emit("job_end", job.hpc, job.id);

        // exit loop
        return;
      }
    }
  }

  async pushJobToQueue(job: Job) {
    await this.queues[job.hpc].push(job);
    this.emitter.registerEvents(
      job,
      "JOB_QUEUED",
      "job [" + job.id + "] is queued, waiting for registration"
    );
  }

  destroy() {
    clearInterval(this.maintainerMasterThread);
  }

  getJob(jobId: any) {
    console.log("getting job");
    for (var hpc in hpcConfigMap) {
      console.log("checking " + hpc);
      for (var i = 0; i < +this.queues[hpc].length; i++) {
        console.log("checking if " + jobId + " is " + this.queues[hpc][i].id);
        if (this.queues[hpc][i].id == jobId) {
          console.log("found it");
          return this.queues[hpc][i];
        }
      }
    }
    console.log("not found");
    return null;
  }
}

export default Supervisor;
