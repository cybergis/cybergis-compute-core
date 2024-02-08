import { options, hpcConfig, SSH } from "../types";
import { ConnectorError } from "../errors";
import BaseMaintainer from "../maintainers/BaseMaintainer";
import DB from "../DB";
import { existsSync, unlink, writeFileSync } from 'fs';
import * as path from "path";
import connectionPool from "./ConnectionPool";
import { config, hpcConfigMap } from "../../configs/config";
import FileUtil from "../lib/FolderUtil";

/**
 * Connects the job to the HPC environment through maintainer
 */
class BaseConnector {

  /** parent pointer **/
  public maintainer: BaseMaintainer;

  /** properties **/
  public jobId: string;

  public hpcName: string;

  public is_cvmfs: boolean;

  public remote_executable_folder_path: string;

  public remote_data_folder_path: string;

  public remote_result_folder_path: string;

  /** config **/
  public config: hpcConfig;

  public db = new DB();

  protected envCmd = "#!/bin/bash\n";

  constructor(
    hpcName: string,
    jobId: string = null,
    maintainer: BaseMaintainer = null,
    env: { [keys: string]: any } = {},
    is_cvmfs: boolean = false
  ) {
    this.hpcName = hpcName;
    this.jobId = jobId;
    this.config = hpcConfigMap[hpcName];
    this.maintainer = maintainer;
    this.is_cvmfs = is_cvmfs;

    var envCmd = "source /etc/profile;";
    for (var i in env) {
      const v = env[i];
      envCmd += `export ${i}=${v};\n`;
    }
    this.envCmd = envCmd;
    this.remote_executable_folder_path = null;
    this.remote_data_folder_path = null;
    this.remote_result_folder_path = null;
  }

  /** actions **/
  /**
     Returns ssh connection from maintainer configuration
     */
  ssh(): SSH {
    if (this.config.is_community_account) {
      return connectionPool[this.hpcName].ssh;
    } else {
      return connectionPool[this.jobId].ssh;
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
   * @return {Object} out - maintainer output
   *
   */
  async exec(
    commands: string | Array<string>,
    options: options = {},
    muteEvent = true,
    muteLog = true,
    continueOnError = false
  ) {
    type out = {
      stdout: string | null;
      stderr: string | null;
    };

    const out: out = {
      stdout: null,
      stderr: null,
    };
    const maintainer = this.maintainer;

    options = Object.assign(
      {
        cwd: this.config.root_path,
      },
      options
    );

    if (typeof commands === "string") {
      commands = [commands];
    }

    var opt = Object.assign(
      {
        onStdout(o) {
          o = o.toString();
          if (out.stdout === null) out.stdout = o;
          else out.stdout += o;

          if (maintainer && !muteLog) maintainer.emitLog(o);
        },
        onStderr(o) {
          o = o.toString();
          if (out.stderr === null) out.stderr = o;
          else out.stderr += o;

          if (maintainer && !muteLog) maintainer.emitLog(o);
          if (maintainer && !muteEvent) maintainer.emitEvent("SSH_STDERR", o);
        },
      },
      options
    );

    for (var i in commands) {
      const command = commands[i].trim();
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_RUN",
          "running command [" + command + "]"
        );
      await this.ssh().connection.execCommand(this.envCmd + command, opt);
      if (out.stderr && !continueOnError) break; // behavior similar to &&
    }

    return out;
  }

  /** file operators **/
  /**
   * @aysnc
   * Uncompresses the specified zip file to the Local folder
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  async download(from: string, to: string, muteEvent = false) {
    if (to === undefined)
      throw new ConnectorError("please init input file first");
    const fromZipFilePath = from.endsWith(".zip") ? from : `${from}.zip`;
    const toZipFilePath = `${to}.zip`;
    await this.zip(from, fromZipFilePath);

    try {
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_SCP_DOWNLOAD",
          `get file from ${from} to ${to}`
        );
      await this.ssh().connection.getFile(to, fromZipFilePath);
      await this.rm(fromZipFilePath);
      await FileUtil.putFileFromZip(to, toZipFilePath);
    } catch (e) {
      var error = `unable to get file from ${from} to ${to}: ` + e.toString();
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent("SSH_SCP_DOWNLOAD_ERROR", error);
      throw new ConnectorError(error);
    }
  }
  /**
   * @aysnc
   * Transfers a file from the local machine to remote machine
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  async transferFile(from: string, to: string, muteEvent = false) {
    try {
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_SCP_UPLOAD",
          `put file from ${from} to ${to}`
        );
      await this.ssh().connection.putFile(from, to);
    } catch (e) {
      const error =
        `unable to put file from ${from} to ${to}: ` + e.toString();
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent("SSH_SCP_UPLOAD_ERROR", error);
      throw new ConnectorError(error);
    }
  }
  /**
   * @aysnc
   * Compresses the contents of the LocalFolder to the specified zip file
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  async upload(from: string, to: string, muteEvent = false) {
    const toZipFilePath = to.endsWith(".zip") ? to : `${to}.zip`;
    const toFilePath = to.endsWith(".zip") ? to.replace(".zip", "") : to;
    await this.transferFile(from, toZipFilePath);
    await this.unzip(toZipFilePath, toFilePath);
    await this.rm(toZipFilePath);
  }

  /** helpers **/
  /**
   * @aysnc
   * Returns the homeDirectory path
   *
   * @param{Object} options - dictionary with string options
   * @return{Object} - returns command execution output
   */
  // getters
  async homeDirectory(options: options = {}) {
    const out = await this.exec("cd ~;pwd;", options);
    return out.stdout;
  }

  /**
   * @aysnc
   * Returns the username
   *
   * @param{Object} options - dictionary with string options
   * @return{Object} - returns command execution output
   */
  async whoami(options: options = {}) {
    const out = await this.exec("whoami;", options);
    return out.stdout;
  }

  /**
   * @aysnc
   * Returns the specified path
   *
   * @param{string} path - execution path
   * @param{Object} options - dictionary with string options
   * @return{Object} - returns command execution output
   */
  async pwd(path: string = undefined, options: options = {}) {
    var cmd = "pwd;";
    if (path) cmd = "cd " + path + ";" + cmd;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * Returns all of the files/directories in specified path
   *
   * @param{string} path - specified path
   * @param{Object} options - dictionary with string options
   * @return{Object} - returns command execution output
   */
  async ls(path: string = undefined, options: options = {}) {
    var cmd = "ls;";
    if (path) cmd = "cd " + path + ";" + cmd;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * creates an empty file at specified path
   *
   * @param(string) path - specified path with filename
   * @param(Object) options - dictionary with string options
   * @return(Object) returns - command execution output
   */
  async cat(path: string, options: options = {}) {
    var cmd = "cat " + path;
    const out = await this.exec(cmd, options);
    return out.stdout;
  }

  // file operators
  /**
   * @aysnc
   * removes the file/folder at specified path
   *
   * @param(string) path - specified path with filename
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async rm(path: string, options: options = {}, muteEvent = false) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_RM", `removing ${path}`);
    const out = await this.exec(`rm -rf ${path};`, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * creates directory at specified path
   *
   * @param(string) path - specified path with filename
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async mkdir(path: string, options: options = {}, muteEvent = false) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_MKDIR", `removing ${path}`);
    const out = await this.exec(`mkdir -p ${path};`, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * zips the file/directory at specified path
   *
   * @param(string) from - input file/directory path
   * @param(string) to - compress file path with file name
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async zip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_ZIP", `zipping ${from} to ${to}`);
    const out = await this.exec(
      `zip -q -r ${to} . ${path.basename(from)}`,
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
   * @aysnc
   * unzips the file/folder at specified path
   *
   * @param(string) from - input file/directory path
   * @param(string) to - compress file path with file name
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async unzip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_UNZIP", `unzipping ${from} to ${to}`);
    const out = await this.exec(`unzip -o -q ${from} -d ${to}`, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * tars the file/directory at specified path
   *
   * @param(string) from - input file/directory path
   * @param(string) to - compress file path with file name
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async tar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_TAR", `taring ${from} to ${to}`);
    to = to.endsWith(".tar") ? to : to + ".tar";
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
   * @aysnc
   * untars the file/directory at specified path
   *
   * @param(string) from - input file/directory path
   * @param(string) to - compress file path with file name
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   * @return(Object) returns - command execution output
   */
  async untar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_UNTAR", `untaring ${from} to ${to}`);
    const out = await this.exec(`tar -C ${to} -xvf ${from}`, options);
    return out.stdout;
  }

  /**
   * @aysnc
   * creates file with specified content
   *
   * @param(string) content - file content
   * @param(string) path - specified path with filename
   * @param(Object) options - dictionary with string options
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event
   */
  async createFile(
    content: string | Object,
    remotePath: string,
    options: options = {},
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_CREATE_FILE", `create file to ${remotePath}`);
    if (typeof content !== "string") {
      content = JSON.stringify(content)
    } 
    // cast to string
    let contentString : string = String(content);
    // use the cache dir
    let tmp_dir: string = config.local_file_system.cache_path
    // create a new tmp file, loop until we find a new one
    var tmp_file = ""
    do {
      tmp_file = 'tmp-' + (Math.random().toString(36)+'00000000000000000').slice(2, 12)
      console.log(tmp_file)
    }
    while(existsSync(path.join(tmp_dir, tmp_file)));
    // local path of the file
    let localPath : string = path.join(tmp_dir, tmp_file);
    // write the content to the tmp file
    writeFileSync(localPath, contentString, {flag: 'w'});
    // upload the file
    await this.transferFile(localPath, remotePath);
    // delete the file
    unlink(localPath, function (err) {
        if (err) {
            console.error(err);
        }
    });
  }

  /**
   * gets remote executable folder path
   *
   * @param(string) providedPath - specified path
   * @return(Object) returns - command execution output
   */
  getRemoteExecutableFolderPath(providedPath: string = null): string {
    if (this.remote_executable_folder_path === null)
      throw new Error("need to set remote_executable_folder_path");
    if (providedPath)
      return path.join(this.remote_executable_folder_path, providedPath);
    else return this.remote_executable_folder_path;
  }

  /**
   * gets remote data folder path
   *
   * @param(string) providedPath - specified path
   * @return(Object) returns - command execution output
   */
  getRemoteDataFolderPath(providedPath: string = null): string {
    if (!this.remote_data_folder_path) return null;
    if (providedPath)
      return path.join(this.remote_data_folder_path, providedPath);
    else return this.remote_data_folder_path;
  }

  /**
   * gets remote result folder path
   *
   * @param(string) providedPath - specified path
   * @return(Object) returns - command execution output
   */
  getRemoteResultFolderPath(providedPath: string = null): string {
    if (this.remote_result_folder_path === null)
      throw new Error("need to set remote_result_folder_path");
    if (providedPath)
      return path.join(this.remote_result_folder_path, providedPath);
    else return this.remote_result_folder_path;
  }

  /**
   *
   * @param providedPath
   */
  setRemoteExecutableFolderPath(providedPath: string) {
    this.remote_executable_folder_path = providedPath;
  }

  setRemoteDataFolderPath(providedPath: string) {
    this.remote_data_folder_path = providedPath;
  }

  setRemoteResultFolderPath(providedPath: string) {
    this.remote_result_folder_path = providedPath;
  }
}

export default BaseConnector;
