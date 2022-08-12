import {
  slurm_integer_storage_unit_config,
  slurm_integer_time_unit_config,
  slurmInputRules,
  slurm_integer_configs,
} from "../types";
import { Job } from "../models/Job";
import {
  hpcConfigMap,
  jupyterGlobusMap,
  maintainerConfigMap,
} from "../../configs/config";
import { config } from "../../configs/config";
import path = require("path");
import DB from "../DB";
const redis = require("redis");
const { promisify } = require("util");

/**
 * Some comment
 */
export class ResultFolderContentManager {
  private redis = {
    getValue: null,
    setValue: null,
    delValue: null,
  };

  private isConnected = false;

  /**
   * Set the value of the job result folder to the contents passed
   *
   * @async
   * @param {string} jobId - This job
   * @param {string[]} contents - Contents to be listed in the result folder
   */
  async put(jobId: string, contents: string[]) {
    await this.connect();
    await this.redis.setValue(
      `job_result_folder_content${jobId}`,
      JSON.stringify(contents)
    );
  }

  /**
   * Return the parsed contents of the results folder
   *
   * @async
   * @param {string} jobId - This job
   * @returns {string[]} - Contents of the results folder
   */
  async get(jobId: string): Promise<string[]> {
    await this.connect();
    var out = await this.redis.getValue(`job_result_folder_content${jobId}`);
    return out ? JSON.parse(out) : null;
  }

  /**
   * Delete the result folder content associated with this job
   *
   * @async
   * @param {string} jobId - This job
   */
  async remove(jobId: string) {
    await this.connect();
    var out = await this.get(jobId);
    if (!out) return;
    this.redis.delValue(`job_result_folder_content${jobId}`);
  }

  /**
   * Connect with host
   *
   * @async
   */
  private async connect() {
    if (this.isConnected) return;

    var client = new redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
    });

    if (config.redis.password != null && config.redis.password != undefined) {
      var redisAuth = promisify(client.auth).bind(client);
      await redisAuth(config.redis.password);
    }

    this.redis.getValue = promisify(client.get).bind(client);
    this.redis.setValue = promisify(client.set).bind(client);
    this.redis.delValue = promisify(client.del).bind(client);
    this.isConnected = true;
  }
}

export default class JobUtil {
  /**
   * Ensure the job has all the nessecary input parameters
   *
   * @static
   * @param job - This job
   * @param paramRules - Parameter rules for this job
   * @throws Job must have a complete parameter list
   */
  static validateParam(job: Job, paramRules: { [keys: string]: any }) {
    for (var i in paramRules) {
      if (!job.param[i]) {
        throw new Error(`job missing input param ${i}`);
      }
    }
  }

  /**
   * Get the total slurm usage of the indicated user
   *
   * @static
   * @async
   * @param {string} userID - User to collect slurm usage from
   * @param {boolean} format - Whether or not the cputume, memory, memoryusage, and walltime are already formatted
   * @returns {Object} - Total slurm usage of the indicated user
   */
  static async getUserSlurmUsage(userId: string, format = false) {
    const db = new DB();
    const connection = await db.connect();
    const jobs = await connection.getRepository(Job).find({ userId: userId });

    var userSlurmUsage = {
      nodes: 0,
      cpus: 0,
      cpuTime: 0,
      memory: 0,
      memoryUsage: 0,
      walltime: 0,
    };

    for (var i in jobs) {
      const job = jobs[i];
      if (job.nodes) userSlurmUsage.nodes += job.nodes;
      if (job.cpus) userSlurmUsage.cpus += job.cpus;
      if (job.cpuTime) userSlurmUsage.cpuTime += job.cpuTime;
      if (job.memory) userSlurmUsage.memory += job.memory;
      if (job.memoryUsage) userSlurmUsage.memoryUsage += job.memoryUsage;
      if (job.walltime) userSlurmUsage.walltime += job.walltime;
    }

    if (format) {
      return {
        nodes: userSlurmUsage.nodes,
        cpus: userSlurmUsage.cpus,
        cpuTime: this.secondsToTimeDelta(userSlurmUsage.cpuTime),
        memory: this.kbToStorageUnit(userSlurmUsage.memory),
        memoryUsage: this.kbToStorageUnit(userSlurmUsage.memoryUsage),
        walltime: this.secondsToTimeDelta(userSlurmUsage.walltime),
      };
    } else {
      return {
        nodes: userSlurmUsage.nodes,
        cpus: userSlurmUsage.cpus,
        cpuTime: userSlurmUsage.cpuTime,
        memory: userSlurmUsage.memory,
        memoryUsage: userSlurmUsage.memoryUsage,
        walltime: userSlurmUsage.walltime,
      };
    }
  }
  /**
   * Ensure this job has valid input data and slurm config rules
   *
   * @static
   * @async
   * @param {Job} job - This job
   * @param {string} jupyterHost - Jupyter host for this job
   * @param {string} username - Username of the user who submitted this job
   * @throws - DataFolder must have a valid path, the job must have upload data, and there must be an executable folder in the maintainerConfig
   */
  static async validateJob(job: Job) {
    // create slurm config rules
    const providedSlurmInputRules: slurmInputRules = {};
    const providedParamRules: { [keys: string]: any } = {};
    const requireUploadData = false;

    if (requireUploadData && !job.localDataFolder && !job.remoteDataFolder) {
      throw new Error(`job missing data file`);
    }
    if (job.localExecutableFolder == undefined) {
      throw new Error("job missing executable file");
    }

    JobUtil.validateSlurmConfig(job, providedSlurmInputRules);
    JobUtil.validateParam(job, providedParamRules);
  }
  /**
   * Set the slurm rules for this job, and ensure that those rules don't exceed the default slurm ceiling
   *
   * @static
   * @param {Job} job - This job
   * @param {slurmInputRules} slurmInputRules - Slurm input rules associated with this job
   * @throws - Slurm input rules associated with this job must not exceed the default slurm ceiling
   */
  static validateSlurmConfig(job: Job, slurmInputRules: slurmInputRules) {
    var slurmCeiling = {};
    var globalInputCap = hpcConfigMap[job.hpc].slurm_global_cap;
    if (!globalInputCap) globalInputCap = {};
    slurmInputRules = Object.assign(
      hpcConfigMap[job.hpc].slurm_input_rules,
      slurmInputRules
    );

    var defaultSlurmCeiling = {
      num_of_node: 50,
      num_of_task: 50,
      cpu_per_task: 50,
      memory_per_cpu: "10G",
      memory_per_gpu: "10G",
      memory: "50G",
      gpus: 20,
      gpus_per_node: 20,
      gpus_per_socket: 20,
      gpus_per_task: 20,
      time: "10:00:00",
    };

    for (var i in slurmInputRules) {
      if (!slurmInputRules[i].max) continue;
      if (slurm_integer_storage_unit_config.includes(i)) {
        slurmCeiling[i] = slurmInputRules[i].max + slurmInputRules[i].unit;
      } else if (slurm_integer_time_unit_config.includes(i)) {
        var val = slurmInputRules[i].max;
        var unit = slurmInputRules[i].unit;
        var sec = JobUtil.unitTimeToSeconds(val, unit);
        slurmCeiling[i] = JobUtil.secondsToTime(sec);
      } else if (slurm_integer_configs.includes(i)) {
        slurmCeiling[i] = slurmInputRules[i].max;
      }
    }

    for (var i in globalInputCap) {
      if (!slurmCeiling[i]) slurmCeiling[i] = globalInputCap[i];
      else if (this.compareSlurmConfig(i, globalInputCap[i], slurmCeiling[i])) {
        slurmCeiling[i] = globalInputCap[i];
      }
    }

    for (var i in defaultSlurmCeiling) {
      if (!slurmCeiling[i]) {
        slurmCeiling[i] = defaultSlurmCeiling[i];
        continue;
      }
    }

    for (var i in slurmCeiling) {
      if (!job.slurm[i]) continue;
      if (this.compareSlurmConfig(i, slurmCeiling[i], job.slurm[i])) {
        throw new Error(
          `slurm config ${i} exceeds the threshold of ${slurmCeiling[i]} (current value ${job.slurm[i]})`
        );
      }
    }
  }

  /**
   * Return true if the slurm config exceeds the threshold of the slurm ceiling.
   *
   * @static
   * @param {string} i - Slurm field that a and b are associated with
   * @param {string} a - Storage or projected time for this job from the slurm ceiling
   * @param {string} b - Storage or projected time for this job for this job
   * @return {boolean} - If the slurm config exceeds the threshold of the slurm ceiling
   */
  static compareSlurmConfig(i, a, b) {
    if (slurm_integer_storage_unit_config.includes(i)) {
      return this.storageUnitToKB(a) < this.storageUnitToKB(b);
    }
    if (slurm_integer_time_unit_config.includes(i)) {
      return this.timeToSeconds(a) < this.timeToSeconds(b);
    }
    return a < b;
  }

  /**
   * Turns the passed amount of storage into kb
   *
   * @static
   * @param {string} i - Amount of storage in original unit
   * @return {number} - Storage in kb
   */
  static storageUnitToKB(i: string) {
    i = i.toLowerCase().replace(/b/gi, "");
    if (i.includes("p")) {
      return parseInt(i.replace("p", "").trim()) * 1024 * 1024 * 1024;
    }
    if (i.includes("g")) {
      return parseInt(i.replace("g", "").trim()) * 1024 * 1024;
    }
    if (i.includes("m")) {
      return parseInt(i.replace("m", "").trim()) * 1024;
    }
  }

  /**
   * Turns the passed amount of storage into the most convenient unit.
   *
   * @static
   * @param {number} i - Amount of storage in kb
   * @return {string} - Storage in most convenient unit (kb, mb, gb, tb, pb, eb)
   */
  static kbToStorageUnit(i: number) {
    var units = ["kb", "mb", "gb", "tb", "pb", "eb"].reverse();
    while (units.length > 0) {
      var unit = units.pop();
      if (i < 1024) return `${i}${unit}`;
      i = i / 1024;
    }
    return `${i}pb`;
  }
  /**
   * Turns the passed time into a string specifying each unit
   *
   * @static
   * @param {number} seconds - Time in seconds
   * @return {string} - Passed time converted into dayds, hours, minutes, seconds format
   */
  static secondsToTimeDelta(seconds: number) {
    var days = Math.floor(seconds / (60 * 60 * 24));
    var hours = Math.floor(seconds / (60 * 60) - days * 24);
    var minutes = Math.floor(seconds / 60 - days * 60 * 24 - hours * 60);
    var seconds = Math.floor(seconds - days * 60 * 60 * 24 - hours * 60 * 60);
    //
    var format = (j) => {
      if (j == 0) return "00";
      else if (j < 10) return `0${j}`;
      else return `${j}`;
    };
    return `${format(days)} days, ${format(hours)} hours, ${format(
      minutes
    )} minutes, ${format(seconds)} seconds`;
  }
  /**
   * Turns the passed time into seconds
   *
   * @static
   * @param {number} time - Time in specified unit
   * @param {string} unit - Unit the passed time is in
   * @return {int} - Passed time converted into seconds
   */
  static unitTimeToSeconds(time: number, unit: string) {
    if (unit == "Minutes") return time * 60;
    if (unit == "Hours") return time * 60 * 60;
    if (unit == "Days") return time * 60 * 60 * 24;
    return 0;
  }
  /**
   * Turns passed seconds time into days-hours:minutes:seconds format
   *
   * @static
   * @param {number} seconds - Time in seconds
   * @return {int} time - Passed seconds time converted to days-hours:minutes:seconds format.
   */
  static secondsToTime(seconds: number) {
    var days = Math.floor(seconds / (60 * 60 * 24));
    var hours = Math.floor(seconds / (60 * 60) - days * 24);
    var minutes = Math.floor(seconds / 60 - days * 60 * 24 - hours * 60);

    var d = days < 10 ? `0${days}` : `${days}`;
    var h = hours < 10 ? `0${hours}` : `${hours}`;
    var m = minutes < 10 ? `0${minutes}` : `${minutes}`;

    if (days == 0) {
      if (hours == 0) {
        return `${m}:00`;
      } else {
        return `${h}:${m}:00`;
      }
    } else {
      return `${d}-${h}:${m}:00`;
    }
  }

  /**
   * Turns passed days-hours:minutes:seconds time into seconds format
   *
   * @static
   * @param {string} raw - Time in days-hours:minutes:seconds format.
   * @return {int} - Passed days-hours:minutes:seconds time converted to seconds.
   */
  static timeToSeconds(raw: string) {
    var i = raw.split(":");
    if (i.length == 1) {
      var j = i[0].split("-");
      if (j.length == 1) {
        // minutes
        return parseInt(i[0]) * 60;
      } else {
        // days-hours
        return parseInt(j[0]) * 60 * 60 * 24 + parseInt(j[0]) * 60 * 60;
      }
    } else if (i.length == 2) {
      var j = i[0].split("-");
      if (j.length == 2) {
        // days-hours:minutes
        return (
          parseInt(j[0]) * 60 * 60 * 24 +
          parseInt(j[1]) * 60 * 60 +
          parseInt(i[1]) * 60
        );
      } else {
        // minutes:seconds
        return parseInt(i[0]) * 60 + parseInt(i[0]);
      }
    } else if (i.length == 3) {
      var j = i[0].split("-");
      if (j.length == 2) {
        // days-hours:minutes:seconds
        return (
          parseInt(j[0]) * 60 * 60 * 24 +
          parseInt(j[1]) * 60 * 60 +
          parseInt(i[1]) * 60 +
          parseInt(i[2])
        );
      } else {
        // hours:minutes:seconds
        return parseInt(i[0]) * 60 * 60 + parseInt(i[1]) * 60 + parseInt(i[2]);
      }
    }
    return Infinity;
  }
}
