import { existsSync, unlink, writeFileSync } from "fs";
import * as path from "path";
import { config, hpcConfigMap } from "../../configs/config";
import DB from "../DB";
import { ConnectorError } from "../errors";
import FileUtil from "../lib/FolderUtil";  // shouldn't this be registerUtil?
import * as Helper from "../lib/Helper";
import BaseMaintainer from "../maintainers/BaseMaintainer";
import { options, hpcConfig, SSH } from "../types";
import connectionPool from "./ConnectionPool";

/**
 * Base class for connecting with the HPC environment, mainly via shell scripts.
 */
class BaseConnector {

  /** parent pointer **/
  public maintainer: BaseMaintainer | null;

  /** properties **/
  public jobId: string | null;
  public hpcName: string;
  public is_cvmfs: boolean;
  public remote_executable_folder_path: string | null;
  public remote_data_folder_path: string | null;
  public remote_result_folder_path: string | null;

  /** config **/
  public connectorConfig: hpcConfig;
  public db = new DB();
  protected envCmd = "#!/bin/bash\n";

  constructor(
    hpcName: string,
    jobId: string | null = null,
    maintainer: BaseMaintainer | null = null,
    env: Record<string, unknown> = {},
    is_cvmfs = false
  ) {
    this.hpcName = hpcName;
    this.jobId = jobId;
    this.connectorConfig = hpcConfigMap[hpcName];
    this.maintainer = maintainer;
    this.is_cvmfs = is_cvmfs;

    // set environment variables
    let envCmd = "source /etc/profile;";
    for (const i in env) {
      const v = env[i] as string;
      envCmd += `export ${i}=${v};\n`;
    }
    this.envCmd = envCmd;

    this.remote_executable_folder_path = null;
    this.remote_data_folder_path = null;
    this.remote_result_folder_path = null;
  }

  /** actions **/

  /**
     Returns ssh connection from maintainer configuration (for community accounts).
    */
  ssh(): SSH {
    if (this.connectorConfig.is_community_account) {
      return connectionPool[this.hpcName].ssh;
    } else {
      return connectionPool[this.jobId!].ssh;
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
  async exec(
    commands: string | string[],
    options: options = {},
    muteEvent = true,
    muteLog = true,
    continueOnError = false
  ) {
    interface out {
      stdout: string | null;
      stderr: string | null;
    }

    const out: out = {
      stdout: null,
      stderr: null,
    };
    const maintainer = this.maintainer;

    // add cwd to options (current working directory) to set root path
    options = Object.assign(
      {
        cwd: this.connectorConfig.root_path,
      },
      options
    );

    if (typeof commands === "string") {
      commands = [commands];
    }

    // add functionality to pipe out stdout/stderr to maintainer logs/events into options
    // enabled by NodeSSH library
    const opt = Object.assign(
      {
        onStdout(chunk: Buffer) {
          const o: string = chunk.toString();
          if (out.stdout === null) out.stdout = o;
          else out.stdout += o;

          if (maintainer && !muteLog) maintainer.emitLog(o);
        },
        onStderr(chunk: Buffer) {
          const o: string = chunk.toString();
          if (out.stderr === null) out.stderr = o;
          else out.stderr += o;

          if (maintainer && !muteLog) maintainer.emitLog(o);
          if (maintainer && !muteEvent) maintainer.emitEvent("SSH_STDERR", o);
        },
      },
      options
    );

    // run the array of commands as if they were
    for (let command of commands) {
      command = command.trim();
      
      // log execution in maintainer event log
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_RUN",
          "running command [" + command + "]"
        );

      // run command via ssh
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore the type is hidden in some file and can't be coerced
      await this.ssh().connection.execCommand(this.envCmd + command, opt);

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
  async download(from: string, to: string, muteEvent = false) {
    if (to === undefined)
      throw new ConnectorError("please init input file first");

    // create from/to zip paths from raw files and zip the from file
    const fromZipFilePath = from.endsWith(".zip") ? from : `${from}.zip`;
    const toZipFilePath = `${to}.zip`;
    await this.zip(from, fromZipFilePath);

    try {
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_SCP_DOWNLOAD",
          `get file from ${from} to ${to}`
        );
      
      // try to get the from file via ssh/scp and remove the compressed folder afterwards
      await this.ssh().connection.getFile(to, fromZipFilePath);
      await this.rm(fromZipFilePath);

      // decompress the transferred file into the toZipFilePath directory
      await FileUtil.putFileFromZip(to, toZipFilePath);
    } catch (e) {
      const error = `unable to get file from ${from} to ${to}: ` + Helper.assertError(e).toString();

      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent("SSH_SCP_DOWNLOAD_ERROR", error);
      throw new ConnectorError(error);
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
  async transferFile(from: string, to: string, muteEvent = false) {
    try {
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent(
          "SSH_SCP_UPLOAD",
          `put file from ${from} to ${to}`
        );
      
      // attempt to send the from file to the to folder
      await this.ssh().connection.putFile(from, to);
    } catch (e) {
      const error =
        `unable to put file from ${from} to ${to}: ` + Helper.assertError(e).toString();
        
      if (this.maintainer && !muteEvent)
        this.maintainer.emitEvent("SSH_SCP_UPLOAD_ERROR", error);
      throw new ConnectorError(error);
    }
  }
  /**
   * @async
   * Compresses the contents of the LocalFolder to the specified zip file on the HPC
   * TODO: actually compress?
   *
   * @param {string} from - input file string
   * @param {string} to - output folder
   * @param {boolean} muteEvent - set to True if you want to mute maintauner emitted Event (unused)
   * @throws {ConnectorError} - Thrown if maintainer emits 'SSH_SCP_DOWNLOAD_ERROR'
   */
  async upload(from: string, to: string, muteEvent=false) { // eslint-disable-line
    // get the to zip/not zipped paths
    const toZipFilePath = to.endsWith(".zip") ? to : `${to}.zip`;
    const toFilePath = to.endsWith(".zip") ? to.replace(".zip", "") : to;

    // transfer file to HPC
    await this.transferFile(from, toZipFilePath);
    // decompress file on HPC
    await this.unzip(toZipFilePath, toFilePath);
    // remove the zipped file
    await this.rm(toZipFilePath);
  }

  /** helpers **/

  /**
   * Returns the homeDirectory path of the HPC
   *
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string>} returns command execution output
   */
  async homeDirectory(options: options = {}): Promise<string | null> {
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
  async whoami(options: options = {}): Promise<string | null> {
    const out = await this.exec("whoami;", options);
    return out.stdout;
  }

  /**
   * @async
   * Returns the specified path
   *
   * @param {string} [path=undefined] execution path
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string>} returns command execution output
   */
  async pwd(
    path: string | undefined = undefined, 
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
   * @param {string} [path=undefined] specified path
   * @param {options} [options={}] dictionary with string options
   * @return {Promise<string | null>} returns command execution output
   */
  async ls(
    path: string | undefined = undefined, 
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
  async cat(path: string, options: options = {}): Promise<string | null> {
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
  async remoteFsExists(path: string, options?: options): Promise<boolean> {
    const out = await this.exec(`test -d ${path} && echo a`, options ?? {});
    return out !== null;
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
  async rm(
    path: string, 
    options: options = {}, 
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_RM", `removing ${path}`);

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
  async mkdir(
    path: string, 
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_MKDIR", `removing ${path}`);

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
  async zip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_ZIP", `zipping ${from} to ${to}`);

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
  async unzip(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_UNZIP", `unzipping ${from} to ${to}`);

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
  async tar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_TAR", `taring ${from} to ${to}`);

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
  async untar(
    from: string,
    to: string,
    options: options = {},
    muteEvent = false
  ): Promise<string | null> {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_UNTAR", `untaring ${from} to ${to}`);

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
  async createFile(
    content: string | Record<string, unknown>,
    remotePath: string,
    options: options = {},  // eslint-disable-line
    muteEvent = false
  ) {
    if (this.maintainer && !muteEvent)
      this.maintainer.emitEvent("SSH_CREATE_FILE", `create file to ${remotePath}`);

    if (typeof content !== "string") {
      content = JSON.stringify(content);
    }

    // cast to string
    const contentString  = String(content);
    // use the cache dir
    const tmp_dir: string = config.local_file_system.cache_path;
    
    // create a new tmp file, loop until we find a new one
    let tmp_file = "";
    do {
      tmp_file = "tmp-" + (Math.random().toString(36)+"00000000000000000").slice(2, 12);
      // console.log(tmp_file);
    }
    while(existsSync(path.join(tmp_dir, tmp_file)));

    // local path of the file
    const localPath : string = path.join(tmp_dir, tmp_file);

    // write the content to the tmp file
    writeFileSync(localPath, contentString, {flag: "w"});

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
   * @param {string} [providedPath=null] specified path
   * @return {string} command execution output
   */
  getRemoteExecutableFolderPath(providedPath: string | null = null): string {
    if (this.remote_executable_folder_path === null)
      throw new Error("need to set remote_executable_folder_path");
    
    if (providedPath)
      return path.join(this.remote_executable_folder_path, providedPath);
    else 
      return this.remote_executable_folder_path;
  }

  /**
   * gets remote data folder path
   *
   * @param {string} [providedPath=null] specified path
   * @return {string | null} command execution output
   */
  getRemoteDataFolderPath(providedPath: string | null = null): string | null {
    if (!this.remote_data_folder_path) return null;

    if (providedPath)
      return path.join(this.remote_data_folder_path, providedPath);
    else 
      return this.remote_data_folder_path;
  }

  /**
   * gets remote result folder path
   *
   * @param {string} [providedPath=null] specified path
   * @return {string} command execution output
   */
  getRemoteResultFolderPath(providedPath: string | null = null): string {
    if (this.remote_result_folder_path === null)
      throw new Error("need to set remote_result_folder_path");

    if (providedPath)
      return path.join(this.remote_result_folder_path, providedPath);
    else 
      return this.remote_result_folder_path;
  }

  /**
   * Sets remote executable folder path instance variable.
   * 
   * @param providedPath
   */
  setRemoteExecutableFolderPath(providedPath: string) {
    this.remote_executable_folder_path = providedPath;
  }

  /**
   * Sets remote data folder path instance variable.
   *
   * @param {string} providedPath
   */
  setRemoteDataFolderPath(providedPath: string) {
    this.remote_data_folder_path = providedPath;
  }

  /**
   * Setes remote reuslt folder path instance variable.
   *
   * @param {string} providedPath
   */
  setRemoteResultFolderPath(providedPath: string) {
    this.remote_result_folder_path = providedPath;
  }
}

export default BaseConnector;
