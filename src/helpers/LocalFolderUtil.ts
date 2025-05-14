import { spawn } from "child_process";
import * as fs from "fs/promises";
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
  let fileHandle: fs.FileHandle | undefined;
  try {
    fileHandle = await fs.open(filePath, "r");
    const { buffer } = await fileHandle.read(Buffer.alloc(4), 0, 4, 0);
    await fileHandle.close();
    return buffer.equals(Buffer.from([0x50, 0x4B, 0x03, 0x04])); // "PK\x03\x04"
  } catch (_) {
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 *
 * @param filePath path to check
 * @returns true if this path is a directory, false if a file
 */
export async function isDirectory(filePath: string): Promise<boolean> {
  const stats = await fs.stat(filePath);
    
  if (stats.isDirectory()) {
    return true;
  } else if (stats.isFile()) {
    return false;
  }

  throw new Error("file path is neither a directory nor a file");
}

/**
 * Zips a directory.
 * @param filePath - directory path (absolute)
 * @throws {FileNotExistError} thrown if zipping fails/if the zip path doesn't exist
 * @returns the file path of the resulting zip file
 */
export async function folderZip(filePath: string): Promise<string> {
  if (!(await exists(filePath))) throw new FileNotExistError("target file does not exist");
  if (!(await isDirectory(filePath))) throw new Error("zip file should be a folder");

  // we need this zipping logic with the manual cwd, otherwise the zip file would have many layers due to the larger 
  // path needed to specify the file being zipped
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
    await fs.unlink(filePath);
  }
}

/**
 * Deletes an (empty) folder.
 * @param filePath path to the directory
 */
async function _removeFolder(filePath: string) {
  if (await exists(filePath)) {
    await fs.rmdir(filePath, { recursive: true });
  }
}

/**
 * Tests if a file path exists (and if the user is able to access it). 
 * @param filePath file path to check existence for
 * @returns true if accessible; false otherwise
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}


// /**
//  * Unzips a zip file. 
//  * @param filePath output path
//  * @param zipFilePath path of the zip file
//  * @throws {FileNotExistError} if zip file to unzip does not exist on file system
//  * @returns promise for whether the zip was successful
//  */
// export async function putFileFromZip(filePath: string, zipFilePath: string) {
//   if (!(await exists(filePath))) {
//     throw new FileNotExistError("file not exists or initialized");
//   }

//   const child = spawn("unzip", [
//     "-o", // overwrite
//     "-q", // quiet mode
//     `${zipFilePath}`, // thing to unzip
//     "-d", // specify output directory
//     `${filePath}`, // output directory
//   ]);

//   // handle errors in unzip
//   return new Promise((resolve, reject) => {
//     child.on("exit", () => resolve(`${filePath}.zip`));
//     child.on("close", () => resolve(`${filePath}.zip`));
//     child.on("error", () => reject(new Error(`${filePath}.zip`)));
//   });
// }
