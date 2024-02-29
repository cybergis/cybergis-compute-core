import { hpcConfigMap, jupyterGlobusMap } from "../../configs/config";
import { Job } from "../models/Job";
// import * as fs from "fs";


/**
 * Converts base64 string to binary form.
 *
 * @param {string} target b64 string to be encoded
 * @return {string} equivalent binary string
 */
export function btoa(target: string): string {
  return Buffer.from(target, "base64").toString("binary");
}

/**
 * Converts binary string to base64.
 * 
 * @param {string} target binary string to be encoded
 * @returns {string} b64 encoding of target
 */
export function atob(target: string): string {
  return Buffer.from(target).toString("base64");
}

/**
 * Generates a random id composed of a number based on time and a random string of length 5. 
 * 
 * @returns {string} random 15 digit ID (number of unix digits + random string)
 */
export function generateId(): string {
  return Math.round(new Date().getTime() / 1000) + randomStr(5);
}

/**
 * Converts a job to a dictionary object, with logic for excluding certain fields. 
 *
 * @param {(Job | Job[])} job attributes of a job (can be recursively called)
 * @param {Array} [exclude=[]] list of attributes to exclude
 * @return {(object | object[])} job object including all attributes in the job list and excluding fields specified in exclude
 */
export function job2object(
  job: Job | Job[], 
  exclude: string[] = []
): object | object[] {
  if (Array.isArray(job)) {
    const outArray: object[] = [];
    for (const j of job) {
      outArray.push(job2object(j));
    }
    return outArray;
  }
  
  const out: Record<string, unknown> = {};
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

  for (const i of include) {
    if (exclude.includes(i)) continue;
    if (i in job) out[i] = job[i];
    else out[i] = null;
  }
  return out;
}

/**
 *Generates a string of random length.
  *
  * @param {number} length desired length of the return string
  * @return {string} random string of size length
  */
export function randomStr(length: number): string {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

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
export function isAllowlisted(host: string): boolean {
  const jupyterGlobus = jupyterGlobusMap[host];

  if (!jupyterGlobus) {
    return false;
  }

  return true;
}

/**
 *Checks if a user is authenticated for an HPC. 
  *
  * @param {string} user the user to check for
  * @param {string} hpc the HPC to check for
  * @return {boolean} whether the user is authenticated
  */
export function canAccessHPC(user: string, hpc: string): boolean {
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
}

export function assertError(err: unknown): Error {
  if (!(err instanceof Error)) {
    throw err;
  }

  return err;
}

export const consoleEnd = "\x1b[0m";

export const consoleGreen = "\x1b[32m";

export function nullGuard<T>(x: null | T | undefined): asserts x is T {
  const e = new Error();
  const frame = e.stack?.split("\n");
  if (!frame) {
    console.assert(
      x !== null && x !== undefined, 
      "%o", "Variable is undefined/null when it should not be. No stack frame found."  // eslint-disable-line
    );
    return;
  }

  const lineNumber = frame[2].split(":").reverse()[1];
  const functionName = frame[2].split(" ")[5];
  console.assert(
    x !== null && x !== undefined, 
    "%o", 
    `Variable is undefined/null when it should not be. Assertion at ${frame[0]}, ${functionName}: ${lineNumber}`
  );
}
