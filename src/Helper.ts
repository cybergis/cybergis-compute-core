import { Job } from "./models/Job";
import { hpcConfigMap, jupyterGlobusMap } from "../configs/config";
import * as fs from "fs";

var Helper = {
  /**
   * 
   * @param target b64 string to be encoded
   * @returns binary encoding of target
   */
  btoa(target: string): string {
    return Buffer.from(target, "base64").toString("binary");
  },

  /**
   * 
   * @param target binary string to be encoded
   * @returns b64 encoding of target
   */
  atob(target: string): string {
    return Buffer.from(target).toString("base64");
  },

  /**
   * 
   * @returns random 5 digit ID 
   */
  generateId(): string {
    return Math.round(new Date().getTime() / 1000) + Helper.randomStr(5);
  },

  /**
   * 
   * @param job list of attributes of a job
   * @param exclude list of attributes to exclude
   * @returns job object including all attributes in the job list and excluding fields specified in exclude
   */
  job2object(job: Job | Job[], exclude = []): Object | Object[] {
    if (Array.isArray(job)) {
      var outArray: Object[] = [];
      for (var i in job) {
        outArray.push(Helper.job2object(job[i]));
      }
      return outArray;
    }
    //
    var out = {};
    var include = [
      "id",
      "userId",
      "secretToken",
      "slurmId",
      "maintainer",
      "hpc",
      "remoteExecutableFolder",
      "remoteDataFolder",
      "remoteResultFolder",
      "localExecutableFolder",
      "localDataFolder",
      "param",
      "env",
      "slurm",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "initializedAt",
      "finishedAt",
      "isFailed",
      "events",
      "logs",
    ];
    for (var i in include) {
      i = include[i];
      if (exclude.includes(i)) continue;
      if (i in job) out[i] = job[i];
      else out[i] = null;
    }
    return out;
  },
  /**
   * 
   * @param length desired length of the return string
   * @returns random string of length length
   */
  randomStr(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },

  /**
   * 
   * @param obj object to check
   * @returns whether or not that object is empty
   */
  isObjectEmpty(obj): boolean {
    return Object.keys(obj).length == 0;
  },

  /**
   * 
   * @param host JupyterHub submitting jobs
   * @returns bool, whether or not the Jupyter can submit
   */
  isAllowlisted(host: string): boolean {
    var jupyterGlobus = jupyterGlobusMap[host]
    if (!jupyterGlobus) {
        return false;
    }
    return true;
  },

  /**
   * 
   * @param user the user to check for
   * @param hpc the HPC to check for
   * @returns whether or not the user can check the HPC
   */
  canAccessHPC(user: string, hpc: string): boolean {
    var allowList = hpcConfigMap[hpc].allowlist;
    var denyList = hpcConfigMap[hpc].denylist;
    console.log(allowList);
    console.log(denyList);
    // check if they are in the denylist
    if (denyList.includes(user)) {
        return false;
    }
    // check if the allowlist is empty
    if (allowList.length == 0) {
        // if they aren't in the deny and the allow
        // is blank, we assume everyone is fine
        return true;
    }
    else {
        // if the allowList isn't blank, we need to check for them
        return allowList.includes(user);
    }
    // shouldn't be reachable, but print false just in case
    return false;
    },
    

  consoleEnd: "\x1b[0m",

  consoleGreen: "\x1b[32m",

  /**
   *
   * @param funcCall - The function that is run with backoff
   * @param parameters - What the function is input as parameters (in the form of one array)
   * @param printOnError - Printed with error when catch block reached
   */
  async runCommandWithBackoff(funcCall: (...args: any[]) => {}, parameters: any[], printOnError: string | null) {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    var wait = 0;
    var end = false;
    console.error("here");

    while (true && !end) {
      console.error(wait);
      if (wait > 100) {
        throw new Error("The function was attempted too mant times unsuccessfully");
      }
      try {
        await sleep(wait * 1000);
        await funcCall(...parameters);
        end = true;
      } catch (e) {
        console.error(printOnError + e.stack);
      }
      wait = wait == 0 ? 2 : wait * wait;
    }
  }
};

export default Helper;
