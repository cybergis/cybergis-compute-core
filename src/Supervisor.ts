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

  private runningJobs: { [keys: string]: Array<Job> } = {};

  private cancelJobs: { [keys: string]: Array<Job> } = {};

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
      this.runningJobs[hpcName] = new Array<Job>();
      this.cancelJobs[hpcName] = new Array<Job>();
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
            this.runningJobs[job.hpc].push(job);
            console.log(`Added job to running jobs: ${job.id}`);
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
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (true) {
      // get ssh connector from pool
      var ssh: SSH;
      if (job.maintainerInstance.connector.config.is_community_account) {
        ssh = connectionPool[job.hpc].ssh;
      } else {
        ssh = connectionPool[job.id].ssh;
      }

      var exit = false;
      var wait = 0;

      // connect ssh & run
      while (!exit && !ssh.connection.isConnected()) {
        if (wait > 100) {
          exit = true;
          self.emitter.registerEvents(
            job,
            "JOB_FAILED",
            `job [${job.id}] failed because the HPC could not connect within the allotted time`
          );
          continue;
        }
        try {
          await sleep(wait * 1000);
          if (!ssh.connection.isConnected()) {
            await ssh.connection.connect(ssh.config);
          }
          await ssh.connection.execCommand("echo"); // test connection
        } catch (e) {
          if (config.is_testing) console.error(e.stack);
        }
        wait = wait == 0 ? 2 : wait * wait;
      }
      if (job.maintainerInstance.isInit) {
        await job.maintainerInstance.maintain();
      } else {
        await job.maintainerInstance.init();
      }
      // emit events & logs
      var events = job.maintainerInstance.dumpEvents();
      var logs = job.maintainerInstance.dumpLogs();
      // TODO: no need to dump events or logs outside the maintainer
      for (var j in events)
        self.emitter.registerEvents(job, events[j].type, events[j].message);
      for (var j in logs) self.emitter.registerLogs(job, logs[j]);

      // check if job should be canceled
      var shouldCancel = false;
      for (var i = 0; i < this.cancelJobs[job.hpc].length; i++) {
        if (this.cancelJobs[job.hpc][i] == job) {
          shouldCancel = true;
        }
      }
      if (shouldCancel && job.maintainerInstance.jobOnHpc) {
        job.maintainerInstance.onCancel();
        const index = this.cancelJobs[job.hpc].indexOf(job, 0);
        if (index > -1) {
          this.cancelJobs[job.hpc].splice(index, 1);
        }
      }

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

        // remove from running jobs
        var index = this.runningJobs[job.hpc].indexOf(job, 0);
        if (index > -1) {
          this.runningJobs[job.hpc].splice(index, 1);
          console.log(`Removed job from running jobs: ${job.id}`);
        }

        index = this.cancelJobs[job.hpc].indexOf(job, 0);
        if (index > -1) {
          this.cancelJobs[job.hpc].splice(index, 1);
        }

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

  cancelJob(jobId: any) : Job {
    console.log(`cancelJob(${jobId}) looking for job`);
    var toReturn = null;
    var hpcToAdd = null;
    for (var hpc in hpcConfigMap) {
      console.log(`looking in ${hpc}`);
      for (var i = 0; i < +this.queues[hpc].length; i++) {
        console.log(`Queue: checking is ${this.queues[hpc][i].id.toString()}`);
        if (this.queues[hpc][i].id.toString() == jobId.toString()) {
          toReturn = this.queues[hpc][i];
          hpcToAdd = hpc;
        }
      }
      for (var i = 0; i < this.runningJobs[hpc].length; i++) {
        console.log(`RunningJobs: checking is ${this.runningJobs[hpc][i].id.toString()}`);
        if (this.runningJobs[hpc][i].id == jobId.toString()) {
          toReturn = this.runningJobs[hpc][i];
          hpcToAdd = hpc;
        }
      }
    }
    if (toReturn != null) {
      this.cancelJobs[hpcToAdd].push(toReturn)
    } else {
      console.log("Supervisor getJob(" + jobId + "): job not found");
    }
    return toReturn;
  }
}

export default Supervisor;
