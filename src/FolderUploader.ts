import { hpcConfigMap } from "../configs/config";
import BaseConnector from "./connectors/BaseConnector";
import DB from "./DB";
import * as fs from "fs";
import * as path from "path";
import GlobusUtil from "./lib/GlobusUtil";
import FolderUtil from "./lib/FolderUtil";
import {
  GitFolder,
  GlobusFolder,
  hpcConfig,
  LocalFolder,
  NeedUploadFolder,
} from "./types";
import Helper from "./Helper";
import { Folder } from "./models/Folder";
import { Git } from "./models/Git";
import GitUtil from "./lib/GitUtil";
import SlurmConnector from "./connectors/SlurmConnector";
import SingularityConnector from "./connectors/SingularityConnector";

type Connector =
  | BaseConnector
  | SlurmConnector
  | SingularityConnector

/**
 * Base class for encapsulating information about a folder upload.
 */
export class BaseFolderUploader {
  // details about the current HPC/user this uploader pertains to
  public id: string;  // unique id for the uploader
  public hpcPath: string;
  public globusPath: string;
  public hpcName: string;
  public userId: string;
  public hpcConfig: hpcConfig;

  public isComplete: boolean;
  public isFailed: boolean;

  protected db: DB;

  constructor(hpcName: string, userId: string) {
    this.hpcName = hpcName;
    this.hpcConfig = hpcConfigMap[hpcName];
    if (!this.hpcConfig)
      throw new Error(`cannot find hpcConfig with name ${hpcName}`);
    this.hpcPath = path.join(this.hpcConfig.root_path, this.id);
    
    this.id = Helper.generateId();
    this.userId = userId;

    this.isComplete = false;
    this.isFailed = false;
    this.db = new DB();

    this.globusPath = path.join(this.hpcConfig.globus.root_path, this.id);
  }

  async upload() {
    throw new Error("FolderUploader upload not implemented");
  }

  /**
   * Registers the current folder into the Folder database.
   *
   * @protected
   */
  protected async register() {
    const connection = await this.db.connect();
    const folder = new Folder();
    folder.id = this.id;
    folder.hpcPath = this.hpcPath;
    folder.globusPath = this.globusPath;
    folder.hpc = this.hpcName;
    folder.userId = this.userId;

    await connection.getRepository(Folder).save(folder);
  }
}

/**
 * Specialization of BaseFolderUploader for uploading an empty folder.
 */
export class EmptyFolderUploader extends BaseFolderUploader {
  protected connector: Connector;  // too communicate iwth HPC

  constructor(
    hpcName: string,
    userId: string,
    jobId: string,
    connector: Connector
  ) {
    super(hpcName, userId);
    this.connector = connector;
  }

  /**
   * Creates ("uploads") an empty folder onto the HPC at the given path. Updates the database accordingly.
   *
   */
  async upload() {
    await this.connector.mkdir(this.hpcPath, {}, true);  // mkdir {name}
    await this.register();  // register folder in the database
    this.isComplete = true;
  }
}

/**
 * Specialization of BaseFolderUploader for uploading a folder via Globus.
 */
export class GlobusFolderUploader extends BaseFolderUploader {
  private from: GlobusFolder = {};
  private to: GlobusFolder = {};

  private taskId: string;
  private jobId: string;

  constructor(
    from: GlobusFolder,
    hpcName: string,
    userId: string,
    jobId: string
  ) {
    super(hpcName, userId);

    if (!this.hpcConfig)
      throw new Error(`cannot find hpcConfig with name ${hpcName}`);
    if (!this.hpcConfig.globus)
      throw new Error(`cannot find hpcConfig.globus with name ${hpcName}`);

    this.from = from;
    this.to = {
      endpoint: this.hpcConfig.globus.endpoint,
      path: this.globusPath,
    };

    this.jobId = jobId;
  }

  /**
   * Uploads the specified folder to the HPC via globus.
   *
   */
  async upload() {
    // start the transfer
    this.taskId = await GlobusUtil.initTransfer(
      this.from,
      this.to,
      this.hpcConfig,
      "job-id-" + this.jobId + "-upload-folder-" + this.id
    );

    // get status of transfer
    const status = await GlobusUtil.monitorTransfer(
      this.taskId,
      this.hpcConfig
    );

    if (status.includes("FAILED")) {
      this.isComplete = true;
      this.isFailed = true;
    }

    if (status.includes("SUCCEEDED")) {
      this.isComplete = true;
    }

    if (this.isComplete) {
      if (!this.isFailed) {
        await this.register();
      }
    }
  }
}

/**
 * Specialization of BaseFolderUploader for uploading a local folder.
 */
export class LocalFolderUploader extends BaseFolderUploader {
  protected connector: Connector;
  protected localPath: string;

  constructor(
    from: LocalFolder,
    hpcName: string,
    userId: string,
    jobId: string,
    connector: Connector = null
  ) {
    super(hpcName, userId);
    this.localPath = from.localPath;
    this.connector = connector ?? new BaseConnector(hpcName);
  }

  /**
   * Uploads the specified local path to the HPC via SCP.
   *
   * @throws {Error} path needs to be valid
   */
  async upload() {
    // if path does not exist, throw an error
    if (!fs.existsSync(this.localPath)) {
      throw new Error(`could not find folder under path ${this.localPath}`);
    }

    // zip the folder
    const from = await FolderUtil.getZip(this.localPath);
    const to = this.hpcPath;

    // upload via connector and SCP/slurm
    await this.connector.upload(from, to, false);
    // remove the zipped file on the local machine
    await FolderUtil.removeZip(from);

    // register upload in database & mark complete
    await this.register();
    this.isComplete = true;
  }
}

/**
 * Specialization of LocalFolderUploader for uploading a git folder (on the local machine).
 */
export class GitFolderUploader extends LocalFolderUploader {
  private gitId: string;
  private git: Git;

  constructor(
    from: GitFolder,
    hpcName: string,
    userId: string,
    jobId: string,
    connector: Connector = null
  ) {
    const localPath = GitUtil.getLocalPath(from.gitId);  // extract the local path
    super({ localPath }, hpcName, userId, jobId, connector);
    this.gitId = from.gitId;
  }

  async upload() {
    // try to find the git repo in the database
    const connection = await this.db.connect();
    const gitRepo = connection.getRepository(Git);
    this.git = await gitRepo.findOne(this.gitId);
    if (!this.git) {
      throw new Error(`cannot find git repo with id ${this.gitId}`);
    }

    // repull git if old, then upload (via SCP)
    await GitUtil.refreshGit(this.git);
    await super.upload();
  }
}

/**
 * Helper class/method for uploading a generic file, returning the proper folder uploader as required.
 *
 * @export
 */
export class FolderUploaderHelper {

  /**
   * Uploads a generic folder and returns the helper used to do so.
   *
   * @static
   * @param {NeedUploadFolder} from either a GlobusFolder, GitFolder, or LocalFolder
   * @param {string} hpcName name of hpc to uplaod to
   * @param {string} userId current user
   * @param {string} [jobId=""] job associated with the folder upload (optional)
   * @param {Connector} [connector=null] connector to connect to HPC with, if needed
   * @throws {Error} invalid file type/format
   * @return {Promise<BaseFolderUploader>} folder uploader object used to upload the folder, can check if upload was successful via {uploader}.isComplete
   */
  static async upload(
    from: NeedUploadFolder,
    hpcName: string,
    userId: string,
    jobId: string = "",
    connector: Connector = null
  ): Promise<BaseFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new Error("invalid local file format");

    let uploader: BaseFolderUploader;
    switch (from.type) {
    case "git":
      uploader = new GitFolderUploader(
        from,
        hpcName,
        userId,
        jobId,
        connector
      );
      await uploader.upload();
      break;

    case "local":
      uploader = new LocalFolderUploader(
        from,
        hpcName,
        userId,
        jobId,
        connector
      );
      await uploader.upload();
      break;

    case "globus":
      uploader = new GlobusFolderUploader(from, hpcName, userId, jobId);
      await uploader.upload();
      break;

    case "empty":
      uploader = new EmptyFolderUploader(hpcName, userId, jobId, connector);
      await uploader.upload();
      break;

    default:
      throw new Error("undefined file type " + from.type);
    }

    return uploader;
  }
}
