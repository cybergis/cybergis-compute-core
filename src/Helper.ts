import { Job } from "./models/Job";
import * as fs from "fs";

var Helper = {
  btoa(target: string): string {
    return Buffer.from(target, "base64").toString("binary");
  },

  atob(target: string): string {
    return Buffer.from(target).toString("base64");
  },

  generateId(): string {
    return 'upload-folder' + Math.round(new Date().getTime() / 1000) + Helper.randomStr(5);
  },

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

  isObjectEmpty(obj): boolean {
    return Object.keys(obj).length == 0;
  },

  consoleEnd: "\x1b[0m",

  consoleGreen: "\x1b[32m",
};

export default Helper;
