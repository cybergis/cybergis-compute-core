import { Job } from "./models/Job";
import { hpcConfigMap, jupyterGlobusMap } from "../configs/config";
// import * as fs from "fs";

/**
 * Helper function encapsulator
 */
const Helper = {
  
  /**
   * Converts base64 string to binary form.
   *
   * @param {string} target b64 string to be encoded
   * @return {string} equivalent binary string
   */
  btoa(target: string): string {
    return Buffer.from(target, "base64").toString("binary");
  },

  /**
   * Converts binary string to base64.
   * 
   * @param {string} target binary string to be encoded
   * @returns {string} b64 encoding of target
   */
  atob(target: string): string {
    return Buffer.from(target).toString("base64");
  },

  /**
   * Generates a random id composed of a number based on time and a random string of length 5. 
   * 
   * @returns {string} random 5 digit ID 
   */
  generateId(): string {
    return Math.round(new Date().getTime() / 1000) + Helper.randomStr(5);
  },

  /**
   * Converts a job to a dictionary object, with logic for excluding certain fields. 
   *
   * @param {(Job | Job[])} job attributes of a job (can be recursively called)
   * @param {Array} [exclude=[]] list of attributes to exclude
   * @return {(object | object[])} job object including all attributes in the job list and excluding fields specified in exclude
   */
  job2object(job: Job | Job[], exclude = []): object | object[] {
    if (Array.isArray(job)) {
      const outArray: object[] = [];
      for (const i in job) {
        outArray.push(Helper.job2object(job[i]));
      }
      return outArray;
    }
    
    const out = {};
    const include = [
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

    for (let i in include) {
      i = include[i];
      if (exclude.includes(i)) continue;
      if (i in job) out[i] = job[i];
      else out[i] = null;
    }
    return out;
  },

  /**
   *Generates a string of random length.
   *
   * @param {number} length desired length of the return string
   * @return {string} random string of size length
   */
  randomStr(length: number): string {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },

  /**
   * Checks if an object is empty. Not used.
   *
   * @param {Object} obj object to check
   * @return {boolean} whether or not that object is empty
   */
  // isObjectEmpty(obj: object): boolean {
  //   return Object.keys(obj).length === 0;
  // },

  /**
   * Checks if jupyter host is in the config.
   *
   * @param {string} host the exact JupyterHub host
   * @return {boolean} whether or not the Jupyter can submit
   */
  isAllowlisted(host: string): boolean {
    const jupyterGlobus = jupyterGlobusMap[host];

    if (!jupyterGlobus) {
      return false;
    }

    return true;
  },

  /**
   *Checks if a user is authenticated for an HPC. 
   *
   * @param {string} user the user to check for
   * @param {string} hpc the HPC to check for
   * @return {boolean} whether the user is authenticated
   */
  canAccessHPC(user: string, hpc: string): boolean {
    const allowList = hpcConfigMap[hpc].allowlist;
    const denyList = hpcConfigMap[hpc].denylist;
    console.log(allowList);
    console.log(denyList);

    // check if they are in the denylist
    if (denyList.includes(user)) {
      return false;
    }

    // check if the allowlist is empty
    if (allowList.length === 0) {
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
};

export default Helper;
