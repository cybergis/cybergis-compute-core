import * as fs from "fs";
import { spawn } from "child_process";
import { FileNotExistError } from "../errors";
import * as path from "path";

/**
 * Utility class for dealing with (zipped) files. 
 */
export default class registerUtil {


  /**
   * Determines if a file/path is a zip file. 
   *
   * @static
   * @param {string} filePath file/directory path
   * @return {Promise<boolean>} true if the file is zipped; false otherwise
   */
  static async isZipped(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath + ".zip", fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Zips a file/directory.
   *
   * @static
   * @param {string} filePath - file/directory path
   * @throws {Error} thrown if zipping fails
   * @return {Promise<string>} the file path of the resulting zip file
   */
  static async getZip(filePath: string): Promise<string> {
    if (!filePath) throw new Error("getZip operation is not supported");
    if (await this.isZipped(filePath)) return filePath + ".zip";

    try {
      const child = spawn(
        "zip",
        ["-q", "-r", `${filePath}.zip`, ".", `${path.basename(filePath)}`],
        { cwd: filePath }
      );

      return new Promise((resolve, reject) => {
        child.on("exit", () => resolve(`${filePath}.zip`));
        child.on("close", () => resolve(`${filePath}.zip`));
        child.on("error", () => reject(`${filePath}.zip`));
      });
    } catch (e) {
      throw new Error(e);
    }
  }


  /**
   * Deletes (?) a zip file. 
   *
   * @static
   * @param {string} filePath file path excluding the .* at the end
   */
  static async removeZip(filePath: string) {
    if (await this.isZipped(filePath)) {
      await fs.promises.unlink(filePath + ".zip");
    }
  }

  /**
   * Deletes an (empty) folder.
   * 
   * @param {string} filePath path to the directory
   */
  static async removeFolder(filePath: string) {
    if (await this.exists(filePath)) {
      fs.rmdirSync(filePath, { recursive: true });
    }
  }

  /**
   * Tests if a file path exists (and if the user is able to access it). 
   * 
   * @param {string} filePath 
   * @returns {Promise<boolean>} true if accessible; false otherwise
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }


  /**
   * Unzips a zip file. 
   *
   * @static
   * @param {string} filePath
   * @param {string} zipFilePath
   * @throws {FileNotExistError} file needs to exist
   * @throws {Error} thrown if unzipping fails 
   * @return {*} 
   */
  static async putFileFromZip(filePath: string, zipFilePath: string) {
    if (!(await this.exists(filePath))) {
      throw new FileNotExistError("file not exists or initialized");
    }

    try {
      const child = spawn("unzip", [
        "-o",
        "-q",
        `${zipFilePath}`,
        "-d",
        `${filePath}`,
      ]);
      return new Promise((resolve, reject) => {
        child.on("exit", () => resolve(`${filePath}.zip`));
        child.on("close", () => resolve(`${filePath}.zip`));
        child.on("error", () => reject(`${filePath}.zip`));
      });
    } catch (e) {
      throw new Error(e);
    }
  }
}
