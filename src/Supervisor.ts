import Queue from "./Queue";
import Emitter from "./Emitter";
import { Job } from "./models/Job";
import { SSH } from "./types";
import { config, maintainerConfigMap, hpcConfigMap } from "../configs/config";
import connectionPool from "./connectors/ConnectionPool";
import * as events from "events";
import DB from "./DB";
import NodeSSH = require("node-ssh");

/**
 * Manages 
 */
class Supervisor {

  private db = new DB();  // database reference

  // these maps keep track of the various hpcs
  private jobPoolCapacities: { [keys: string]: number } = {};  // capacity
  private jobPoolCounters: { [keys: string]: number } = {};  // current size
  private queues: { [keys: string]: Queue } = {};  // queues of jobs
  private runningJobs: { [keys: string]: Array<Job> } = {};  // running jobs
  private cancelJobs: { [keys: string]: Array<Job> } = {};  // what jobs to cancel

  private emitter = new Emitter();  // emitter reference

  private maintainerMasterThread: NodeJS.Timeout = null;  // main loop

  private maintainerMasterEventEmitter = new events.EventEmitter();

  private queueConsumeTimePeriodInSeconds =
    config.queue_consume_time_period_in_seconds;

  /**
   * Constructs the supervisor. Populates the instance variables with trackers for all the HPCs in the config. Creates the 
   * master maintainer. 
   */
  constructor() {
    for (const hpcName in hpcConfigMap) {
      const hpcConfig = hpcConfigMap[hpcName];

      // register job pool & queues
      this.jobPoolCapacities[hpcName] = hpcConfig.job_pool_capacity;
      this.jobPoolCounters[hpcName] = 0;
      this.queues[hpcName] = new Queue(hpcName);
      this.runningJobs[hpcName] = new Array<Job>();
      this.cancelJobs[hpcName] = new Array<Job>();
    }

    this.createMaintainerMaster();
  }


  /**
   * Creates the main maintainer for all job execution. Runs in an infinite spaced loop. Ends on destruction. 
   */
  createMaintainerMaster() {
    // queue consumer
    // this function defined here will repeat every x seconds (specified in second parameter)
    this.maintainerMasterThread = setInterval(async () => {

      // iterate over all HPCs
      for (const hpcName in this.jobPoolCounters) {

        // try to fill in the current HPC with jobs
        while (
          this.jobPoolCounters[hpcName] < this.jobPoolCapacities[hpcName] &&
          !(await this.queues[hpcName].isEmpty())
        ) {
          const job = await this.queues[hpcName].shift();
          if (!job) continue;

          const maintainer = require(`./maintainers/${ // eslint-disable-line
            maintainerConfigMap[job.maintainer].maintainer
          }`).default; // typescript compilation hack 

          try {
            // push the job
            job.maintainerInstance = new maintainer(job);
            this.runningJobs[job.hpc].push(job);
            console.log(`Added job to running jobs: ${job.id}`);
          } catch (e) {
            // log error and skip job
            this.emitter.registerEvents(
              job,
              "JOB_INIT_ERROR",
              `job [${job.id}] failed to initialized with error ${e.toString()}`
            );
            job.finishedAt = new Date();
            const connection = await this.db.connect();
            await connection
              .createQueryBuilder()
              .update(Job)
              .where("id = :id", { id: job.id })
              .set({ finishedAt: job.finishedAt })
              .execute();
            continue;
          }

          this.jobPoolCounters[hpcName]++;

          // manage ssh pool -- diferent behavior for community/noncommunity accounts
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
          this.emitter.registerEvents(
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
      this.jobPoolCounters[hpcName]--;
    });
  }

  /**
   * Creates a maintainer worker for a given job. 
   *
   * @param {Job} job
   */
  async createMaintainerWorker(job: Job) {
    while (true) {  // eslint-disable-line
      // get ssh connector from pool
      let ssh: SSH;
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
      const events = job.maintainerInstance.dumpEvents();
      const logs = job.maintainerInstance.dumpLogs();

      // TODO: no need to dump events or logs outside the maintainer
      for (const j in events)
        this.emitter.registerEvents(job, events[j].type, events[j].message);
      for (const j in logs) this.emitter.registerLogs(job, logs[j]);

      // check if job should be canceled
      let shouldCancel = false;
      for (let i = 0; i < this.cancelJobs[job.hpc].length; i++) {
        if (this.cancelJobs[job.hpc][i] === job) {
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
        let index = this.runningJobs[job.hpc].indexOf(job, 0);
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


  /**
   * Adds a job to the job queue. 
   *
   * @param {Job} job job to add
   */
  async pushJobToQueue(job: Job) {
    await this.queues[job.hpc].push(job);
    this.emitter.registerEvents(
      job,
      "JOB_QUEUED",
      "job [" + job.id + "] is queued, waiting for registration"
    );
  }

  /**
   * Stops the master thread execution. 
   */
  destroy() {
    clearInterval(this.maintainerMasterThread);
  }


  /**
   * Cancels the job associated with the given job id. 
   *
   * @param {*} jobId
   * @return {Job} the job that was cancelled
   */
  cancelJob(jobId: any): Job {
    console.log(`cancelJob(${jobId}) looking for job`);
    let toReturn = null;
    let hpcToAdd = null;

    // look for the job in teh queue
    for (const hpc in hpcConfigMap) {
      console.log(`looking in ${hpc}`);
      for (let i = 0; i < +this.queues[hpc].length; i++) {
        console.log(`Queue: checking is ${this.queues[hpc][i].id.toString()}`);
        if (this.queues[hpc][i].id.toString() === jobId.toString()) {
          toReturn = this.queues[hpc][i];
          hpcToAdd = hpc;
        }
      }

      // look for the job in the running jobs
      for (let i = 0; i < this.runningJobs[hpc].length; i++) {
        console.log(`RunningJobs: checking is ${this.runningJobs[hpc][i].id.toString()}`);
        if (this.runningJobs[hpc][i].id === jobId.toString()) {
          toReturn = this.runningJobs[hpc][i];
          hpcToAdd = hpc;
        }
      }
    }
    
    // if found, cancel it; otherwise log it
    if (toReturn !== null) {
      this.cancelJobs[hpcToAdd].push(toReturn);
    } else {
      console.log("Supervisor getJob(" + jobId + "): job not found");
    }

    return toReturn;
  }
}

export default Supervisor;
