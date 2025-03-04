import NodeSSH = require("node-ssh");

import assert from "assert";
import { existsSync, unlink, writeFileSync } from "fs";
import * as path from "path";

import { config, hpcConfigMap } from "../../configs/config";
import { SSHConfig, ConnectorError, SSH } from "../definitions";
import { options, hpcConfig } from "../definitions";
import { putFileFromZip } from "../helpers/FolderUtil";
import * as Helper from "../helpers/Helper";
import { Job } from "../models";


// TODO: have more sophisticated way to do this
interface Connection {
  ssh: NodeSSH;
  lastUsed: number;
  count: number;
}

const TIMEOUT = 3 * 60 * 1000;

class ConnectionPool {
  private jobConnectionPool: Record<string, Connection> = {};

  private hpcConnectionPool: Record<string, Connection> = {};
  private hpcConnectionSettings: Record<string, SSHConfig> = {};

  public constructor() {
    for (const hpcName in hpcConfigMap) {
      const hpcConfig = hpcConfigMap[hpcName];
      if (!hpcConfig.is_community_account) continue;

      // register community account SSH
      const sshConfig: SSHConfig = {
        host: hpcConfig.ip,
        port: hpcConfig.port,
        username: hpcConfig.community_login.user,
      };

      if (hpcConfig.community_login.use_local_key) {
        sshConfig.privateKey = config.local_key.private_key_path;
        if (config.local_key.passphrase) {
          sshConfig.passphrase = config.local_key.passphrase as string;
        }
      } else {
        sshConfig.privateKey =
          hpcConfig.community_login.external_key.private_key_path;
        if (hpcConfig.community_login.external_key.passphrase) {
          sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase;
        }
      }

      this.hpcConnectionPool[hpcName] = { ssh: new NodeSSH(), count: 0, lastUsed: 0 };
      this.hpcConnectionSettings[hpcName] = sshConfig;
    }

    setInterval(() => {this.cleanupJobs();}, TIMEOUT);
  }

  public async getHpcConnection(hpcName: string): Promise<SSH> {
    if (!(hpcName in this.hpcConnectionPool)) {
      return new NodeSSH();
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.ssh.isConnected()) {
      return connection.ssh;
    }

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection.ssh, this.hpcConnectionSettings[hpcName]], null);
    } catch (e) {
      return new NodeSSH();
    }

    return connection.ssh;
  }

  public releaseJobConnection(job: Job) {
    if (!(job.id in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.jobConnectionPool[job.id];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  public releaseHpcConnection(hpcName: string) {
    if (!(hpcName in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  public async getJobConnection(job: Job): Promise<NodeSSH> {
    if (!(job.id in this.jobConnectionPool)) {
      this.jobConnectionPool[job.id] = {
        ssh: new NodeSSH(),
        count: 0,
        lastUsed: 0
      };
    }

    const connection = this.jobConnectionPool[job.id];
    connection.lastUsed = Date.now();
    connection.count++;

    if (connection.ssh.isConnected()) {
      return connection.ssh;
    }

    const hpcConfig = hpcConfigMap[job.hpc];
    const config: SSHConfig = {
      host: hpcConfig.ip,
      port: hpcConfig.port,
      username: job.credential?.user,
      password: job.credential?.password,
      readyTimeout: 1000,
    };

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection.ssh, config], null);
    } catch (e) {
      return new NodeSSH();
    }

    return connection.ssh;
  }

  private cleanupJobs() {
    const time = Date.now();
    for (const hpc in this.hpcConnectionPool) {
      const connection = this.hpcConnectionPool[hpc];

      const shouldDispose = connection.count === 0 && time - connection.lastUsed > TIMEOUT || 
                      time - connection.lastUsed > 4 * TIMEOUT;

      if (shouldDispose) {
        connection.ssh.dispose();
  
        if (time - connection.lastUsed > 4 * TIMEOUT) {
          connection.count = 0;
        }
      }
    }

    for (const job in this.jobConnectionPool) {
      const connection = this.jobConnectionPool[job];

      const shouldDispose = connection.count === 0 && time - connection.lastUsed > TIMEOUT || 
                      time - connection.lastUsed > 4 * TIMEOUT;

      if (shouldDispose) {
        delete this.jobConnectionPool[job];
        connection.ssh.dispose();
  
        if (time - connection.lastUsed > 4 * TIMEOUT) {
          connection.count = 0;
        }
      }
    }
  }
}

const connectionPool = new ConnectionPool();

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

  public constructor(
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

    this.getSSH().then((x) => {
      if (!x.isConnected()) {
        throw new ConnectorError("unable to establish ssh connection");
      }
    }).catch((e) => {throw e;})
      .finally(() => this.releaseSSH());
  }

  private async getSSH(): Promise<SSH> {
    if (this.hpcConfig.is_community_account) {
      return connectionPool.getHpcConnection(this.hpcName);
    } else {
      return connectionPool.getJobConnection(this.job!);
    }
  }

  public releaseSSH() {
    if (this.hpcConfig.is_community_account) {
      connectionPool.releaseHpcConnection(this.hpcName);
    } else {
      connectionPool.releaseJobConnection(this.job!);
    }
  }

  private emitLog(s: string, muteLog = false) {
    if (this.emitLogFn && !muteLog) {
      this.emitLogFn(s);
    }
  }

  private emitEvent(type: string, message: string, muteEvent = false) {
    if (this.emitEventFn && !muteEvent) {
      this.emitEventFn(type, message);
    }
  }

  /**
   * @async
   * Executes the command on the maintainer and returns the outpt
   *
   * @param {string} commands - command/commands that need to be executed
   * @param {string} options - execution options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @param {boolean} muteLog - set to True if you want to mute maintainer emitted Log
   * @param {boolean} continueOnError - set to True if you want the command/commands to continue despite errors
   * @return {Record<string, string>} out - maintainer output
   *
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

  /** file operators **/

  /**
   * @async
   * Uncompresses the specified zip file to the Local folder (downloads a folder from the HPC to the local machine)
   *
   * @param {string} from - input file string (input folder to download)
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintainer emitted Event
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR' or if input file not given
   */
  public async download(from: string, to: string, muteEvent = false) {
    if (to === undefined)
      throw new ConnectorError("please init input file first");

    // create from/to zip paths from raw files and zip the from file
    const fromZipFilePath = from.endsWith(".zip") ? from : `${from}.zip`;
    const toZipFilePath = `${to}.zip`;
    await this.zip(from, fromZipFilePath);

    const ssh = await this.getSSH();

    try {
      this.emitEvent(
        "SSH_SCP_DOWNLOAD",
        `get file from ${from} to ${to}`,
        muteEvent
      );

      // try to get the from file via ssh/scp and remove the compressed folder afterwards
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff.call(this, (async (to1: string, zipPath: string) => {
        await ssh.getFile(to1, zipPath);
      }) , [to, fromZipFilePath], "Trying to download file again");
      await this.rm(fromZipFilePath);

      // decompress the transferred file into the toZipFilePath directory
      await putFileFromZip(to, toZipFilePath);
    } catch (e) {
      const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();

      this.emitEvent("SSH_SCP_DOWNLOAD_ERROR", error, muteEvent);
      throw new ConnectorError(error);
    } finally {
      this.releaseSSH();
    }
  }
  /**
   * @async
   * Transfers a file from the local machine to remote machine
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  public async transferFile(from: string, to: string, muteEvent = false) {
    const ssh = await this.getSSH();

    try {
      this.emitEvent(
        "SSH_SCP_UPLOAD",
        `put file from ${from} to ${to}`,
        muteEvent
      );

      // attempt to send the from file to the to folder
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff.call(this, (async (from1: string, to1: string) => {
        await ssh.putFile(from1, to1);
      }), [from, to], "Trying again to transfer file");

      this.releaseSSH();
    } catch (e) {
      this.releaseSSH();
      const error =
        `unable to put file from ${from} to ${to}: ` + Helper.assertError(e).toString();
      this.emitEvent("SSH_SCP_UPLOAD_ERROR", error, muteEvent);
      throw new ConnectorError(error);
    } finally {
      this.releaseSSH();
    }
  }
  /**
   * @async
   * Uploads a (zipped) folder from the local machine to the target machine. After upload, decompresses the
   * uploaded zip file and then deletes the zip file.
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event (unused)
   * @param {boolean} unzip - set to True if you want it to unzip and remove on the remote machine; false just uploads
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  async upload(from: string, to: string, muteEvent = false, unzip = true) { // eslint-disable-line
    // get the to zip/not zipped paths
    const toZipFilePath = to.endsWith(".zip") ? to : `${to}.zip`;
    const toFilePath = to.endsWith(".zip") ? to.replace(".zip", "") : to;

    // transfer file to HPC
    await this.transferFile(from, toZipFilePath);

    if (unzip) {
      // decompress file on HPC
      await this.unzip(toZipFilePath, toFilePath);
      // remove the zipped file
      await this.rm(toZipFilePath);
    }
  }

  /** helpers **/

  /**
   * Returns the homeDirectory path of the HPC
   *
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string>} returns command execution output
   */
  public async homeDirectory(options: options = {}): Promise<string | null> {
    const out = await this.exec("cd ~;pwd;", options);
    return out.stdout;
  }

  /**
   * @async
   * Returns the username
   *
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string | null>} returns command execution output
   */
  public async whoami(options: options = {}): Promise<string | null> {
    const out = await this.exec("whoami;", options);
    return out.stdout;
  }

  /**
   * @async
   * Returns the specified path
   *
   * @param {string} execution path
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string>} returns command execution output
   */
  public async pwd(
    path?: string,
    options: options = {}
  ): Promise<string | null> {
    let cmd = "pwd;";
    if (path) cmd = "cd " + path + ";" + cmd;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  /**
   * @async
   * Returns all of the files/directories in specified path
   *
   * @param {string} specified path
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string | null>} returns command execution output
   */
  public async ls(
    path?: string,
    options: options = {}
  ): Promise<string | null> {
    let cmd = "ls;";
    if (path) cmd = "cd " + path + ";" + cmd;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  /**
   * @async
   * creates an empty file at specified path
   *
   * @param {string} path specified path with filename
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string | null>} command execution output
   */
  public async cat(path: string, options: options = {}): Promise<string | null> {
    const cmd = "cat " + path;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  // file operators


  /**
   * @async
   * Determines whether a passed in (absolute) path exists on the HPC. 
   * 
   * @param path path to test for
   * @param options options for doing an exec
   * @returns {Promise<boolean>} true if path exists; false if not
   */
  public async remoteFsExists(path: string, options?: options): Promise<boolean> {
    const out = await this.exec(`test -d ${path} && echo a`, options ?? {});
    return out.stdout !== null;
  }

  /**
   * @async
   * removes the file/folder at specified path
   *
   * @param {string} path specified path with filename
   * @param {options} [options={}] set to True if you want to mute maintauner emitted Event
   * @param {boolean} [muteEvent=false] command execution output
   * @return {Promise<string | null>} 
   */
  public async rm(
    path: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_RM", `removing ${path}`, muteEvent);

    const out = await this.exec(`rm -rf ${path};`, options);
    return out.stdout;
  }

  /**
   * @async
   * creates directory at specified path
   *
   * @param {string} path specified path with filename
   * @param {options} [options={}] dictionary with string options
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   * @return {Promise<string | null>}  command execution output
   */
  public async mkdir(
    path: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_MKDIR", `removing ${path}`, muteEvent);

    const out = await this.exec(`mkdir -p ${path};`, options);
    return out.stdout;
  }

  /**
   * @async
   * zips the file/directory at specified path
   *
   * @param {string} from input file/directory path
   * @param {string} to compress file path with file name
   * @param {options} [options={}] dictionary with string options
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   * @return {Promise<string | null>} command execution output
   */
  public async zip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_ZIP", `zipping ${from} to ${to}`, muteEvent);

    const out = await this.exec(
      `zip -q -r ${to} . ${path.basename(from)}`,  // quiet, recursive, to to at the current directory from the from directory path
      Object.assign(
        {
          cwd: from,  // set cwd to spawn child in the from directory
        },
        options
      )
    );

    return out.stdout;
  }

  /**
   * @async
   * unzips the file/folder at specified path
   *
   * @param {string} from input file/directory path
   * @param {string} to compress file path with file name
   * @param {options} [options={}] dictionary with string options
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   * @return {Promise<string | null>} command execution output
   */
  public async unzip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_UNZIP", `unzipping ${from} to ${to}`, muteEvent);

    const out = await this.exec(`unzip -o -q ${from} -d ${to}`, options);  // quiet mode, overwrite, destination to

    return out.stdout;
  }

  /**
   *
   *
   * @param(string) from - 
   * @param(string) to - 
   * @param(Object) options - 
   * @param {boolean} muteEvent - 
   * @return(Object) returns - 
   */

  /**
   * @async
   * tars the file/directory at specified path
   *
   * @param {string} from input file/directory path
   * @param {string} to compress file path with file name
   * @param {options} [options={}] dictionary with string options
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   * @return {Promise<string | null>}  command execution output
   */
  public  async tar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_TAR", `taring ${from} to ${to}`, muteEvent);

    to = to.endsWith(".tar") ? to : to + ".tar";

    // run the tar file in the from directory, tar everything in the directory
    const out = await this.exec(
      `tar cf ${to} *`,
      Object.assign(
        {
          cwd: from,
        },
        options
      )
    );

    return out.stdout;
  }

  /**
   * @async
   * untars the file/directory at specified path
   *
   * @param {string} from input file/directory path
   * @param {string} to compress file path with file name
   * @param {options} [options={}] dictionary with string options
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   * @return {Promise<string | null>} command execution output
   */
  public async untar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    this.emitEvent("SSH_UNTAR", `untaring ${from} to ${to}`, muteEvent);

    // extract the from tar file to the to directory
    const out = await this.exec(`tar -C ${to} -xvf ${from}`, options);

    return out.stdout;
  }

  /**
   * @async
   * creates file with specified content
   *
   * @param {string | Record<string, unknown>} content file content (either string or dictionary)
   * @param {string} remotePath specified path with filename
   * @param {options} options dictionary with string options (not used)
   * @param {boolean} [muteEvent=false] set to True if you want to mute maintauner emitted Event
   */
  public async createFile(
    content: string | Record<string, unknown>,
    remotePath: string,
    options: options = {},  // eslint-disable-line
    muteEvent = false
  ) {
    this.emitEvent("SSH_CREATE_FILE", `create file to ${remotePath}`, muteEvent);

    if (typeof content !== "string") {
      content = JSON.stringify(content);
    }

    // cast to string
    const contentString = String(content);
    // use the cache dir
    const tmp_dir: string = config.local_file_system.cache_path;

    // create a new tmp file, loop until we find a new one
    let tmp_file = "";
    do {
      tmp_file = "tmp-" + (Math.random().toString(36) + "00000000000000000").slice(2, 12);
      // console.log(tmp_file);
    }
    while (existsSync(path.join(tmp_dir, tmp_file)));

    // local path of the file
    const localPath: string = path.join(tmp_dir, tmp_file);

    // write the content to the tmp file
    writeFileSync(localPath, contentString, { flag: "w" });

    // upload the file
    await this.transferFile(localPath, remotePath);

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
