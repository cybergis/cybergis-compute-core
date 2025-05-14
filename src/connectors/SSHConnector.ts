import assert from "assert";
import { existsSync, unlink } from "fs";
import { writeFile } from "fs/promises";
import * as path from "path";

import { config, hpcConfigMap } from "../../configs/config";
import { ConnectorError, SSH } from "../definitions";
import { options, hpcConfig } from "../definitions";
import * as Helper from "../helpers/Helper";
import { folderZip, removeZip } from "../helpers/LocalFolderUtil";
import { Job } from "../models";

import { connectionPool } from "./ConnectionPool";

interface out {
  stdout: string | null;
  stderr: string | null;
}

type emitLogFnType = (s: string) => void;
type emitEventFnType = (type: string, message: string) => void;


/**
 * Base class for connecting to an HPC machine via SSH.
 */
export class SSHConnector {
  protected hpcName: string;
  protected hpcConfig: hpcConfig; 
  protected envCmd = "#!/bin/bash\n";

  protected emitLogFn?: emitLogFnType;
  protected emitEventFn?: emitEventFnType;
  protected job?: Job;

  public isCommunityAccount: boolean;

  /**
   *
   * @param hpcName hpc this connector will connect to
   * @param job job this connector is for
   * @param emitLogFn callback for emitting logs
   * @param emitEventFn callback for emitting events
   * @param env environment to use when running commands
   */
  protected constructor(
    hpcName: string,
    job?: Job,
    emitLogFn?: emitLogFnType,
    emitEventFn?: emitEventFnType,
    env: Record<string, unknown> = {},
  ) {
    this.hpcName = hpcName;
    this.hpcConfig = hpcConfigMap[this.hpcName];

    if (!this.hpcConfig.is_community_account) {
      assert(job !== undefined);
    }

    this.isCommunityAccount = this.hpcConfig.is_community_account;

    this.job = job;

    // set environment variables
    let envCmd = "source /etc/profile;";
    for (const i in env) {
      const v = env[i] as string;
      envCmd += `export ${i}=${v};\n`;
    }
    this.envCmd = envCmd;

    this.emitLogFn = emitLogFn;
    this.emitEventFn = emitEventFn;
  }

  /**
   * Public interface for constructing an sshconnector, has built-in validation that the ssh connection works. 
   * @param hpcName hpc this connector will connect to
   * @param job job this connector is for
   * @param emitLogFn callback for emitting logs
   * @param emitEventFn callback for emitting events
   * @param env environment to use when running commands
   * @returns the connector, or undefined if construction was unsuccessful
   */
  public static async build(
    hpcName: string,
    job?: Job,
    emitLogFn?: emitLogFnType,
    emitEventFn?: emitEventFnType,
    env: Record<string, unknown> = {}) {
    const connector = new SSHConnector(hpcName, job, emitLogFn, emitEventFn, env);

    const ssh = await connector.getSSH();

    if (!ssh.isConnected()) {
      return undefined;
    }

    return connector;
  }

  /**
   * @returns the ssh connection
   */
  private getSSH(): Promise<SSH> {
    if (this.hpcConfig.is_community_account) {
      return connectionPool.getHpcConnection(this.hpcName);
    } else {
      return connectionPool.getJobConnection(this.job!);
    }
  }

  /**
   *
   */
  public releaseSSH() {
    if (this.hpcConfig.is_community_account) {
      connectionPool.releaseHpcConnection(this.hpcName);
    } else {
      connectionPool.releaseJobConnection(this.job!);
    }
  }

  /**
   *
   * @param s log
   * @param muteLog whether or not to suppress the log
   */
  private emitLog(s: string, muteLog = false) {
    if (this.emitLogFn && !muteLog) {
      this.emitLogFn(s);
    }
  }

  /**
   *
   * @param type type of event
   * @param message event message
   * @param muteEvent whether or not to suppress the event
   */
  private emitEvent(type: string, message: string, muteEvent = false) {
    if (this.emitEventFn && !muteEvent) {
      this.emitEventFn(type, message);
    }
  }

  /**
   *
   * Executes the command on the maintainer and returns the outpt
   * @param commands - command/commands that need to be executed
   * @param options - execution options
   * @param muteEvent - set to True if you want to mute maintauner emitted Event
   * @param muteLog - set to True if you want to mute maintainer emitted Log
   * @param continueOnError - set to True if you want the command/commands to continue despite errors
   * @throws {Error} when the ssh command runs into an error; generally doesn't occur
   * @returns out - maintainer output
   */
  public async exec(
    commands: string | string[],
    options: options = {},
    muteEvent = true,
    muteLog = true,
    continueOnError = false
  ) {
    const out: out = {
      stdout: null,
      stderr: null,
    };

    // add cwd to options (current working directory) to set root path
    options = Object.assign(
      {
        cwd: this.hpcConfig.root_path,
      },
      options
    );

    if (typeof commands === "string") {
      commands = [commands];
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const outer = this;

    // add functionality to pipe out stdout/stderr to maintainer logs/events into options
    // enabled by NodeSSH library
    const opt = Object.assign(
      {
        onStdout(chunk: Buffer) {
          const o: string = chunk.toString();
          if (out.stdout === null) out.stdout = o;
          else out.stdout += o;

          outer.emitLog(o, muteLog);
        },
        onStderr(chunk: Buffer) {
          const o: string = chunk.toString();
          if (out.stderr === null) out.stderr = o;
          else out.stderr += o;

          outer.emitLog(o, muteLog);
          outer.emitEvent("SSH_STDERR", o, muteEvent);
        },
      },
      options
    );

    // run the array of commands as if they were
    for (let command of commands) {
      command = command.trim();
      

      // log execution in maintainer event log
      this.emitEvent(
        "SSH_RUN",
        "running command [" + command + "]",
        muteEvent
      );

      const ssh = await this.getSSH();

      // run command via ssh
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore the type is hidden in some file and can't be coerced
        await ssh.execCommand(this.envCmd + command, opt);
      } catch (e) {
        console.error("error when calling exec on ssh: ", e);
        throw e;
      } finally {
        this.releaseSSH();
      }

      // behavior similar to && operator in bash, if desired (break if have an error)
      if (out.stderr && !continueOnError) break;
    }

    return out;
  }

  /** file operators */

  /**
   *
   * Downloads the zip of a folder from the HPC to the local machine
   * @param fromRemote - path of folder
   * @param toLocal - name of the output file
   * @param muteEvent - set to True if you want to mute maintainer emitted Event
   * @throws {ConnectorError} if exponentially backed off file transfer fails
   */
  public async downloadFolderZip(fromRemote: string, toLocal: string, muteEvent = false) {
    // create from/to zip paths from raw files and zip the from file
    const remoteOutputZipPath = `${fromRemote}.zip`;

    if (!(await this.remoteFsExists(remoteOutputZipPath))) {
      await this.zip(fromRemote, remoteOutputZipPath);
    }

    const ssh = await this.getSSH();

    try {
      this.emitEvent(
        "SSH_SCP_DOWNLOAD",
        `get file from ${fromRemote} to ${toLocal}`,
        muteEvent
      );

      // try to get the from file via ssh/scp and remove the compressed folder afterwards
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff.call(this, (async (to1: string, zipPath: string) => {
        await ssh.getFile(to1, zipPath);
      }) , [toLocal, remoteOutputZipPath], "Trying to download file again");
      void this.rm(remoteOutputZipPath);
    } catch (e) {
      const error = `unable to get file from ${fromRemote} to ${toLocal}: ` + Helper.assertError(e).toString();

      this.emitEvent("SSH_SCP_DOWNLOAD_ERROR", error, muteEvent);
      throw new ConnectorError(error);
    } finally {
      this.releaseSSH();
    }
  }

  /**
   *
   * Uploads the zip of a folder from the local machine to the target machine. 
   * @param fromLocal - input file string
   * @param toRemote - output folder
   * @param muteEvent set to True if you want to mute maintauner emitted Event (unused)
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  public async uploadFolderZip(fromLocal: string, toRemote: string, muteEvent = false) {
    const zipFrom = await folderZip(fromLocal);
    await this.uploadFile(zipFrom, toRemote, muteEvent);
    void removeZip(zipFrom);
  }

  /**
   *
   * Uploads a file from the local machine to the target machine. 
   * @param fromLocal - input file string
   * @param toRemote - output folder
   * @param muteEvent set to True if you want to mute maintauner emitted Event (unused)
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  public async uploadFile(fromLocal: string, toRemote: string, muteEvent = false) {
    const ssh = await this.getSSH();

    try {
      this.emitEvent(
        "SSH_SCP_UPLOAD",
        `put file from ${fromLocal} to ${toRemote}`,
        muteEvent
      );

      // attempt to send the from file to the to folder
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff.call(this, (async (from1: string, to1: string) => {
        await ssh.putFile(from1, to1);
      }), [fromLocal, toRemote], "Trying again to transfer file");
    } catch (e) {
      const error =
        `unable to put file from ${fromLocal} to ${toRemote}: ` + Helper.assertError(e).toString();
      this.emitEvent("SSH_SCP_UPLOAD_ERROR", error, muteEvent);
      throw new ConnectorError(error);
    } finally {
      void removeZip(zipFrom);
      this.releaseSSH();
    }
  }

  /** helpers */

  // /**
  //  * Returns the homeDirectory path of the HPC
  //  * @param [options] dictionary with string options
  //  * @returns returns command execution output
  //  */
  // public async homeDirectory(options: options = {}): Promise<string | null> {
  //   const out = await this.exec("cd ~;pwd;", options);
  //   return out.stdout;
  // }

  // /**
  //  *
  //  * Returns the username
  //  * @param [options] dictionary with string options
  //  * @returns returns command execution output
  //  */
  // public async whoami(options: options = {}): Promise<string | null> {
  //   const out = await this.exec("whoami;", options);
  //   return out.stdout;
  // }

  // /**
  //  *
  //  * Returns the specified path
  //  * @param path path to cd to before getting working directory
  //  * @param options dictionary with string options
  //  * @returns returns command execution output
  //  */
  // public async pwd(
  //   path?: string,
  //   options: options = {}
  // ): Promise<string | null> {
  //   let cmd = "pwd;";
  //   if (path) cmd = "cd " + path + ";" + cmd;
  //   const out = await this.exec(cmd, options);
  //   return out.stdout;
  // }

  // /**
  //  *
  //  * Returns all of the files/directories in specified path
  //  * @param path path to cd to before calling ls
  //  * @param options dictionary with string options
  //  * @returns returns command execution output
  //  */
  // public async ls(
  //   path?: string,
  //   options: options = {}
  // ): Promise<string | null> {
  //   let cmd = "ls;";
  //   if (path) cmd = "cd " + path + ";" + cmd;
  //   const out = await this.exec(cmd, options);
  //   return out.stdout;
  // }

  /**
   *
   * creates an empty file at specified path
   * @param remotePath specified path with filename
   * @param options dictionary with string options
   * @returns command execution output
   */
  public async cat(remotePath: string, options: options = {}): Promise<string | null> {
    const cmd = "cat " + remotePath;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  // file operators


  /**
   *
   * Determines whether a passed in (absolute) path exists on the HPC. 
   * @param path path to test for
   * @param options options for doing an exec
   * @returns true if path exists; false if not
   */
  public async remoteFsExists(path: string, options?: options): Promise<boolean> {
    const out = await this.exec(`test -d ${path} && echo a`, options ?? {});
    return out.stdout !== null;
  }

  /**
   *
   * removes the file/folder at specified path
   * @param remotePath specified path with filename
   * @param options options for the exec
   * @param muteEvent set to True if you want to mute maintauner emitted Event
   * @returns stdout from rm command
   */
  public async rm(
    remotePath: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_RM", `removing ${remotePath}`, muteEvent);

    const out = await this.exec(`rm -rf ${remotePath};`, options);
    return out.stdout;
  }

  /**
   *
   *creates directory at specified path
   * @param remotePath specified path with filename
   * @param [options] dictionary with string options
   * @param [muteEvent] set to True if you want to mute maintauner emitted Event
   * @returns  command execution output
   */
  public async mkdir(
    remotePath: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_MKDIR", `creating ${remotePath}`, muteEvent);

    const out = await this.exec(`mkdir -p ${remotePath};`, options);
    return out.stdout;
  }

  /**
   *
   * zips the file/directory at specified path
   * @param fromRemote path of input file/directory (absolute) on the remote machine
   * @param toRemote path of the compressed file to create on the remote machine
   * @param options dictionary with string options
   * @param muteEvent set to True if you want to mute maintauner emitted Event
   * @returns command execution output
   */
  public async zip(
    fromRemote: string,
    toRemote: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_ZIP", `zipping ${fromRemote} to ${toRemote}`, muteEvent);

    const out = await this.exec(
      `zip -q -r ${toRemote} . ${path.basename(fromRemote)}`,  // quiet, recursive, to to at the current directory from the from directory path
      Object.assign(
        {
          cwd: fromRemote,  // set cwd to spawn child in the from directory
        },
        options
      )
    );

    return out.stdout;
  }

  /**
   *
   * unzips the file/folder at specified path
   * @param fromRemote path to zipped file
   * @param toRemote destination folder to extract to
   * @param deleteZip whether or not to delete the zip file after unzipping
   * @param options dictionary with string options
   * @param muteEvent set to True if you want to mute maintauner emitted Event
   * @returns command execution output
   */
  public async unzip(
    fromRemote: string,
    toRemote: string,
    deleteZip = false,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_UNZIP", `unzipping ${fromRemote} to ${toRemote}`, muteEvent);

    const out = await this.exec(`unzip -o -q ${fromRemote} -d ${toRemote}`, options);  // quiet mode, overwrite, zip file, destination path

    if (deleteZip) {
      void this.rm(fromRemote);
    }

    return out.stdout;
  }

  // /**
  //  * tars the file/directory at specified path
  //  * @param from input file/directory path
  //  * @param to compress file path with file name
  //  * @param options [{}] dictionary with string options
  //  * @param muteEvent [false] set to True if you want to mute maintauner emitted Event
  //  * @returns command execution output
  //  */
  // public async tar(
  //   from: string,
  //   to: string,
  //   options: options = {},
  //   muteEvent = false
  // ): Promise<string | null> {
  //   this.emitEvent("SSH_TAR", `taring ${from} to ${to}`, muteEvent);

  //   to = to.endsWith(".tar") ? to : to + ".tar";

  //   // run the tar file in the from directory, tar everything in the directory
  //   const out = await this.exec(
  //     `tar cf ${to} *`,
  //     Object.assign(
  //       {
  //         cwd: from,
  //       },
  //       options
  //     )
  //   );

  //   return out.stdout;
  // }

  // /**
  //  *
  //  * untars the file/directory at specified path
  //  * @param from input file/directory path
  //  * @param to compress file path with file name
  //  * @param [options] dictionary with string options
  //  * @param [muteEvent] set to True if you want to mute maintauner emitted Event
  //  * @returns command execution output
  //  */
  // public async untar(
  //   from: string,
  //   to: string,
  //   options: options = {},
  //   muteEvent = false
  // ): Promise<string | null> {
  //   this.emitEvent("SSH_UNTAR", `untaring ${from} to ${to}`, muteEvent);

  //   // extract the from tar file to the to directory
  //   const out = await this.exec(`tar -C ${to} -xvf ${from}`, options);

  //   return out.stdout;
  // }

  /**
   *
   * creates file with specified content
   * @param content file content (either string or dictionary)
   * @param remotePath destination path (where the file will be created on the remote machine)
   * @param _options dictionary with string options (not used)
   * @param muteEvent set to True if you want to mute maintauner emitted Event
   * @throws {ConnectorError} if file transfer of content to remote fails
   */
  public async createFile(
    content: string | Record<string, unknown>,
    remotePath: string,
    _options: options = {},
    muteEvent = false
  ) {
    this.emitEvent("SSH_CREATE_FILE", `create file to ${remotePath}`, muteEvent);

    if (typeof content !== "string") {
      content = JSON.stringify(content);
    }

    // cast to string
    const contentString = String(content);
    // use the cache dir
    const localTmpDir: string = config.local_file_system.cache_path;

    // create a new tmp file, loop until we find a new one
    let localTmpFile = "";
    do {
      localTmpFile = "tmp-" + (Math.random().toString(36) + "00000000000000000").slice(2, 12);
      // console.log(tmp_file);
    }
    while (existsSync(path.join(localTmpDir, localTmpFile)));

    // local path of the file
    const localPath: string = path.join(localTmpDir, localTmpFile);

    // write the content to the tmp file
    await writeFile(localPath, contentString, { flag: "w" });

    // upload the file
    await this.uploadFile(localPath, remotePath);

    // delete the file
    unlink(localPath, function (err) {
      if (err) {
        console.error(err);
      }
    });
  }
}


// // dictionary recording ssh connections for community accounts (which have public ssh ability)
// const connectionPool: Record<string, { counter: number, ssh: SSH }> = {};

// // populates the connectionPool with community account HPCs
// for (const hpcName in hpcConfigMap) {
//   const hpcConfig = hpcConfigMap[hpcName];
//   if (!hpcConfig.is_community_account) continue;

//   // register community account SSH
//   const sshConfig: SSHConfig = {
//     host: hpcConfig.ip,
//     port: hpcConfig.port,
//     username: hpcConfig.community_login.user,
//   };

//   if (hpcConfig.community_login.use_local_key) {
//     sshConfig.privateKey = config.local_key.private_key_path;
//     if (config.local_key.passphrase) {
//       sshConfig.passphrase = config.local_key.passphrase as string;
//     }
//   } else {
//     sshConfig.privateKey =
//       hpcConfig.community_login.external_key.private_key_path;
//     if (hpcConfig.community_login.external_key.passphrase) {
//       sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase;
//     }
//   }

//   connectionPool[hpcName] = {
//     counter: 0,
//     ssh: {
//       connection: new NodeSSH(),
//       config: sshConfig,
//     },
//   };
// }

// export default connectionPool;
