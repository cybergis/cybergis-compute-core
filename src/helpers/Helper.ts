import { config, hpcConfigMap, jupyterGlobusMap } from "../../configs/config";
import { callableFunction } from "../definitions";
import { Job } from "../models";
// import * as fs from "fs";

/**
 * Converts base64 string to binary form.
 * @param target b64 string to be encoded
 * @returns equivalent binary string
 */
export function btoa(target: string): string {
  return Buffer.from(target, "base64").toString("binary");
}

/**
 * Converts binary string to base64.
 * @param target binary string to be encoded
 * @returns b64 encoding of target
 */
export function atob(target: string): string {
  return Buffer.from(target).toString("base64");
}

/**
 * Generates a random id composed of a number based on time and a random string of length 5. 
 * @returns random 15 digit ID (number of unix digits + random string)
 */
export function generateId(): string {
  return Math.round(new Date().getTime() / 1000) + randomStr(5);
}

/**
 * Converts a job to a dictionary object, with logic for excluding certain fields. 
 * @param job attributes of a job (can be recursively called)
 * @param [exclude] list of attributes to exclude
 * @returns job object including all attributes in the job list and excluding fields specified in exclude
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
  const include = Object.getOwnPropertyNames(job);

  for (const i of include) {
    if (exclude.includes(i)) continue;
    if (i in job) {
      // if (job[i as keyof Job] === undefined) {
      //   out[i] = null;
      // } else {
      out[i] = job[i as keyof Job];
      // }
    }
    else out[i] = null;
  }

  return out;
}

/**
 *Generates a string of random length.
 * @param length desired length of the return string
 * @returns random string of size length
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
 * @param {object} obj object to check
 * @returns {boolean} whether or not that object is empty
 */
// isObjectEmpty(obj: object): boolean {
//   return Object.keys(obj).length === 0;
// },

/**
 * Checks if jupyter host is in the config.
 * @param host the exact JupyterHub host
 * @returns whether or not the Jupyter can submit
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
 * @param user the user to check for
 * @param hpc the HPC to check for
 * @returns whether the user is authenticated
 */
export function canAccessHPC(user: string, hpc: string): boolean {
  const allowList = hpcConfigMap[hpc].allowlist;
  const denyList = hpcConfigMap[hpc].denylist;
  if (config.is_testing) console.log(allowList);
  if (config.is_testing) console.log(denyList);

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

}

/**
 * Asserts that an object is an error. 
 * @param err error to assert
 * @throws {TypeError} if the object is not an error
 * @returns resulting error
 */
export function assertError(err: unknown): Error {
  if (!(err instanceof Error)) {
    throw new TypeError("object expected to be an error is not an error");
  }

  return err;
}

export const consoleEnd = "\x1b[0m";

export const consoleGreen = "\x1b[32m";

/**
 * Checks if an object is nullish; if it is, it gives a soft warning
 * @param x object to check
 */
export function nullGuard<T>(x: null | T | undefined): asserts x is T {
  const e = new Error();
  const frame = e.stack?.split("\n");
  if (!frame) {
    console.assert(
      x !== null && x !== undefined,
      "%o", "Variable is undefined/null when it should not be. No stack frame found."
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

/**
 *
 * @param funcCall - The function that is run with backoff
 * @param parameters - What the function is input as parameters (in the form of one array)
 * @param printOnError - Printed with error when catch block reached
 * @throws {Error} if unable to run the function within the specified backoff limit
 */
export async function runCommandWithBackoff(
  funcCall: callableFunction,
  parameters: unknown[],
  printOnError: string | null
) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let wait = 0;
  let end = false;

  while (!end) {
    if (wait > 100) {
      throw new Error("The function was attempted too mant times unsuccessfully");
    }
    try {
      await sleep(wait * 1000);
      await funcCall(...parameters);
      end = true;
    } catch (e) {
      console.error(printOnError ?? "" + assertError(e).stack);
    }
    wait = wait === 0 ? 2 : wait * wait;
  }
}