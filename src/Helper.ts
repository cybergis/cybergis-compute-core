import { Job } from "./models/Job";
import { jupyterGlobusMap } from "../configs/config";
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

  isAllowlisted(host: string): boolean {
    var jupyterGlobus = jupyterGlobusMap[host]
    if (!jupyterGlobus) {
        return false;
    }
    return true;
  },

  consoleEnd: "\x1b[0m",

  consoleGreen: "\x1b[32m",
};

export default Helper;
