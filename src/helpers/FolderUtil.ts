import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { FileNotExistError } from "../definitions";

/**
 * Utility functions for dealing with (zipped) files. 
 */

/**
 * Determines if a file/path is a zip file. 
 * @param filePath file/directory path
 * @returns true if the file is zipped; false otherwise
 */
export async function isZipped(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath + ".zip", fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Zips a file/directory.
 * @param filePath - file/directory path
 * @throws {Error} thrown if zipping fails
 * @returns the file path of the resulting zip file
 */
export async function getZip(filePath: string): Promise<string> {
  if (!(await exists(filePath))) throw new FileNotExistError("target file does not exist");
  if (await isZipped(filePath)) return filePath + ".zip";

  const child = spawn(
    "zip",
    ["-q", // quiet mode
      "-r", // zip recursively (folder)
      `${filePath}.zip`, // output path
      ".", // current directory to output to
      `${path.basename(filePath)}` // thing to zip
    ],
    { cwd: filePath }  // specify current working directory of the spawned child
  );

  // handle errors in zip
  return new Promise((resolve, reject) => {
    child.on("exit", () => resolve(`${filePath}.zip`));
    child.on("close", () => resolve(`${filePath}.zip`));
    child.on("error", () => reject(new Error(`${filePath}.zip`)));
  });
}


/**
 * Removes a zip file. 
 * @param filePath file path excluding the .* at the end
 */
export async function removeZip(filePath: string) {
  if (await isZipped(filePath)) {
    await fs.promises.unlink(filePath + ".zip");
  }
}

/**
 * Deletes an (empty) folder.
 * @param filePath path to the directory
 */
export async function removeFolder(filePath: string) {
  if (await exists(filePath)) {
    fs.rmdirSync(filePath, { recursive: true });
  }
}

/**
 * Tests if a file path exists (and if the user is able to access it). 
 * @param filePath file path to check existence for
 * @returns true if accessible; false otherwise
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}


/**
 * Unzips a zip file. 
 * @param filePath file path to zip
 * @param zipFilePath path of the zipped file
 * @returns promise for whether the zip was successful
 */
export async function putFileFromZip(filePath: string, zipFilePath: string) {
  if (!(await exists(filePath))) {
    throw new FileNotExistError("file not exists or initialized");
  }

  const child = spawn("unzip", [
    "-o", // overwrite
    "-q", // quiet mode
    `${zipFilePath}`, // thing to unzip
    "-d", // specify output directory
    `${filePath}`, // output directory
  ]);

  // handle errors in unzip
  return new Promise((resolve, reject) => {
    child.on("exit", () => resolve(`${filePath}.zip`));
    child.on("close", () => resolve(`${filePath}.zip`));
    child.on("error", () => reject(new Error(`${filePath}.zip`)));
  });
}

