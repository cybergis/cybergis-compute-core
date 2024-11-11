import { spawn } from "child_process";
import * as path from "path";

import { ConnectorError } from "../utils/errors";
import * as Helper from "./Helper"; 
import connectionPool from "../connectors/ConnectionPool";
import { callableFunction, SSH } from "../utils/types";
import FolderUtil from "./FolderUtil";

export default class DownloadUploadUtil {
  private async exec(command: string, options: any): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true, ...options });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data;
      });

      child.stderr.on('data', (data) => {
        stderr += data;
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  private ssh(jobId: string) : SSH {
    return connectionPool[jobId!].ssh;
  }

  private async zip(
    from: string,
    to: string
  ): Promise<string | null> {
    const out = await this.exec(
      `zip -q -r ${to} . ${path.basename(from)}`,  // quiet, recursive, to to at the current directory from the from directory path
      Object.assign(
        {
          cwd: from,  // set cwd to spawn child in the from directory
        },
        {}
      )
    );

    return out.stdout;
  }

  private async rm(
    path: string
  ): Promise<string | null> {

    const out = await this.exec(`rm -rf ${path};`, {});
    return out.stdout;
  }

  async download(from: string, to: string, jobId: string) {
    if (to === undefined)
      throw new ConnectorError("please init input file first");

    // create from/to zip paths from raw files and zip the from file
    const fromZipFilePath = from.endsWith(".zip") ? from : `${from}.zip`;
    const toZipFilePath = `${to}.zip`;
    await this.zip(from, fromZipFilePath);

    try {      
      // try to get the from file via ssh/scp and remove the compressed folder afterwards
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff.call(this, (async (to1: string, zipPath: string) => {
        await this.ssh(jobId).connection.getFile(to1, zipPath);
      }) as callableFunction, [to, fromZipFilePath], "Trying to download file again");
      await this.rm(fromZipFilePath);

      // decompress the transferred file into the toZipFilePath directory
      await FolderUtil.putFileFromZip(to, toZipFilePath);
    } catch (e) {
      const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();
      throw new ConnectorError(error);
    }
  }
}

