import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import * as path from "path";

import { ConnectorError } from "../definitions";
import { connectionPool } from "../utils/ConnectionPool";

import { putFileFromZip } from "./FolderUtil";
import * as Helper from "./Helper";

async function exec(
  command: string,
  options: SpawnOptionsWithoutStdio
): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    console.log("executing command", command);
    const child = spawn(command, { shell: true, ...options });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.stderr.on("data", (data) => {
      stderr += data;
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Exec failed with ${err.toString()}`));
    });

    console.log("executed command", command);
  });
}

async function zip(
  from: string,
  to: string,
  hpc: string
): Promise<string | null> {
  console.log("zipping file from", from, "to", to);
  const ssh = await connectionPool.getHpcConnection(hpc);

  if (ssh === null) {
    return null;
  }

  const command = `zip -q -r ${to} ${path.basename(from)}`;
  const { stdout, stderr } = await ssh.execCommand(
    command, { cwd: path.dirname(from) }
  );
  if (stderr) {
    throw new Error(`Failed to zip file: ${stderr}`);
  }
  console.log("zipped file from", from, "to", to);
  return stdout;
}

async function rm(
  path: string
): Promise<string | null> {
  console.log("removing path", path);
  const out = await exec(`rm -rf ${path};`, {});
  console.log("removed path", path);
  return out.stdout;
}

export async function download(from: string, to: string, hpc: string): Promise<void> {
  console.log("downloading file from", from, "to", to);
  if (to === undefined)
    throw new ConnectorError("please init input file first");

  // create from/to zip paths from raw files and zip the from file
  const fromZipFilePath = from.endsWith(".zip") ? from : `${from}.zip`;
  const toZipFilePath = `${to}.zip`;
  await zip(from, fromZipFilePath, hpc);

  console.log("start download");

  try {
    // try to get the from file via ssh/scp and remove the compressed folder afterwards
    // wraps command with backoff -> takes lambda function and array of inputs to execute command
    await Helper.runCommandWithBackoff(async (to1: string, zipPath: string) => {
      const ssh = await connectionPool.getHpcConnection(hpc);

      if (ssh === null) {
        return;
      }

      await ssh.getFile(to1, zipPath);
    }, [to, fromZipFilePath], "Trying to download file again");
    await rm(fromZipFilePath);

    // decompress the transferred file into the toZipFilePath directory
    await putFileFromZip(to, toZipFilePath);
  } catch (e) {
    const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();
    throw new ConnectorError(error);
  }
  console.log("downloaded file from", from, "to", to);
}

