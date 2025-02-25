

import * as fs from "fs";
import * as path from "path";

import { hpcConfigMap } from "../../configs/config";
import BaseConnector from "../connectors/BaseConnector";
import SingularityConnector from "../connectors/SingularityConnector";
import SlurmConnector from "../connectors/SlurmConnector";
import FolderUtil from "../helpers/FolderUtil";
import GitUtil from "../helpers/GitUtil";
import { GlobusClient } from "../helpers/GlobusTransferUtil";
import * as Helper from "../helpers/Helper";
import { Cache } from "../models/Cache";
import { Folder } from "../models/Folder";

import dataSource from "./DB";
import { NotImplementedError } from "./errors";
import {
  BaseFolder,
  GitFolder,
  GlobusFolder,
  hpcConfig,
  LocalFolder,
} from "./types";

type Connector =
  | BaseConnector
  | SlurmConnector
  | SingularityConnector

/**
 * Base class for encapsulating information about a folder upload.
 */
export abstract class BaseFolderUploader {
  // details about the current HPC/user this uploader pertains to
  public id: string;  // unique id for the uploader
  public hpcPath: string;
  public globusPath: string | null;  // possibly nullable
  public hpcName: string;
  public userId: string;
  public hpcConfig: hpcConfig;

  public isComplete: boolean;
  public isFailed: boolean;

  protected connector: Connector;

  constructor(hpcName: string, userId: string, connector?: Connector) {
    this.hpcName = hpcName;
    this.hpcConfig = hpcConfigMap[hpcName];
    if (!this.hpcConfig)
      throw new Error(`cannot find hpcConfig with name ${hpcName}`);

    this.id = Helper.generateId();
    this.userId = userId;
    
    this.hpcPath = path.join(this.hpcConfig.root_path, this.id);

    this.isComplete = false;
    this.isFailed = false;
    this.globusPath = (this.hpcConfig.globus 
      ? path.join(this.hpcConfig.globus.root_path, this.id) 
      : null
    ); 

    this.connector = connector ?? new BaseConnector(hpcName);
  }

  // eslint-disable-next-line
  abstract upload(): Promise<void>;

  /**
   * Registers the current folder into the Folder database.
   *
   * @protected
   */
  protected async register() {
    if (this.isComplete && !this.isFailed) {
      const folder = new Folder();
      folder.id = this.id;
      folder.hpcPath = this.hpcPath;
      if (this.globusPath) {
        folder.globusPath = this.globusPath;
      }
      folder.hpc = this.hpcName;
      folder.userId = this.userId;

      await dataSource.getRepository(Folder).save(folder);
    }
  }
}

/**
 * Specialization of BaseFolderUploader for uploading an empty folder.
 */
export class EmptyFolderUploader extends BaseFolderUploader {

  constructor(
    hpcName: string,
    userId: string,
    jobId: string,
    connector?: Connector
  ) {
    super(hpcName, userId, connector);
  }

  /**
   * Creates ("uploads") an empty folder onto the HPC at the given path. 
   * Updates the database accordingly.
   *
   */
  public async upload() {
    await this.connector.mkdir(this.hpcPath, {}, true);  // mkdir {name}
    this.isComplete = true;
    await this.register();  // register folder in the database
  }
}

// /**
//  * Specialization of BaseFolderUploader for supporting globus transfers. Not cached. 
//  *
//  * @export
//  * @extends {BaseFolderUploader}
//  */
// export class GlobusFolderUploader extends BaseFolderUploader {
//   private from: GlobusFolder;
//   private to: GlobusFolder;

//   private taskId: string;
//   private jobId: string;

//   public globusPath: string;  // not nullable here

//   constructor(
//     from: GlobusFolder,
//     hpcName: string,
//     userId: string,
//     jobId: string
//   ) {
//     super(hpcName, userId);

//     if (!this.hpcConfig)
//       throw new Error(`cannot find hpcConfig with name ${hpcName}`);
//     if (!this.hpcConfig.globus)
//       throw new Error(`cannot find hpcConfig.globus with name ${hpcName}`);

//     this.from = from;
//     this.to = {
//       endpoint: this.hpcConfig.globus.endpoint,
//       path: this.globusPath,
//     };

//     this.jobId = jobId;
//   }

//   /**
//    * Uploads the specified folder to the HPC via globus.
//    *
//    */
//   async upload() {
//     // start the transfer
//     this.taskId = await GlobusUtil.initTransfer(
//       this.from,
//       this.to,
//       this.hpcConfig,
//       "job-id-" + this.jobId + "-upload-folder-" + this.id
//     );

//     // get status of transfer
//     const status = await GlobusUtil.monitorTransfer(
//       this.taskId,
//       this.hpcConfig
//     );

//     if (status.includes("FAILED")) {
//       this.isComplete = true;
//       this.isFailed = true;
//     }

//     if (status.includes("SUCCEEDED")) {
//       this.isComplete = true;
//     }

//     if (this.isComplete) {
//       if (!this.isFailed) {
//         await this.register();
//       }
//     }
//   }
// }

/**
 * This folder uploader adds the capability to cache results on the HPC to avoid having to rezip, rescp-globus, and unzip things
 * everytime a new job with the same inputs are created. Essentially, all uploaded zip files are stored, and the cache is checked
 * upon any folder upload If the cache contains the desired file, just unzip it from there and skip any folder uploading logic.
 *
 * TODO: if the paths stay the same, it will still used the cache version (which might be okay, just have refresh path)
 * 
 * @abstract
 * @class CachedFolderUploader
 * @extends {BaseFolderUploader}
 */
abstract class CachedFolderUploader extends BaseFolderUploader {
  protected cachePath: string;

  constructor(
    cacheFile: string,
    hpcName: string,
    userId: string,
    connector?: Connector,
  ) {
    super(hpcName, userId, connector);

    this.cachePath = path.join(this.hpcConfig.root_path, "cache", `${cacheFile}.zip`);
  }

  /**
   * Initializes the cached folder uploader by creating the cache directory at the root path. 
   * Must be called before using the uploader for absolute safety, but it only needs to be
   * called once ever (unless the scratch space is wiped)
   */
  public async init() {
    // initialize cache if it does not exist
    const cacheRoot = path.join(this.hpcConfig.root_path, "cache");
    if (!(await this.connector.remoteFsExists(cacheRoot))) {
      await this.connector.mkdir(cacheRoot);
    }
  }

  /**
   * Determines whether a cached directory actually exists on a remote HPC.
   *
   * @private
   * @return {Promise<boolean>} true if the directory exists, false otherwise
   */
  private async cacheExists(): Promise<boolean> {
    return this.connector.remoteFsExists(this.cachePath);
  }

  /**
   * Explicitly removes a remote cached directory, if it exists.
   *
   * @private
   */
  private async clearCache() {
    if (!(await this.cacheExists())) {
      return;
    }

    await this.connector.rm(this.cachePath);
  }

  /**
   * Unzips a cached zip file to the hpc path, where it will be used in jobs.
   *
   * @private
   */
  private async pullFromCache() {
    // assert cached file exists
    await this.connector.unzip(this.cachePath, this.hpcPath);
  }

  /**
   * Abstract function implemented by more concrete folder uploaders. Encompasses the general functionality
   * of uploading the files associated with a given job (as encapsulated by a general folder uploader) to
   * the internally stored cache path.
   *
   * @protected
   * @abstract
   * @param {boolean} _force whether or not to force upload (used for force refresh)
   */
  protected abstract uploadToCache(): Promise<void>;


  /**
   * Abstract function implemented by more concrete folder uploaders. Encompasses the general requirement to
   * determine when job files were last truly updated externally, to be compared with the stored update times in
   * the database to decide whether to refrehs.
   *
   * @protected
   * @abstract
   * @return {Promise<number>} Last update time in UNIX time (milliseconds)
   */
  protected abstract getCanonicalUpdateTime(): Promise<number>;

  public async cachedUpload() {
    const recordedUpdate = await this.getRecordedUpdateTime(); 
    const canonicalUpdate = await this.getCanonicalUpdateTime();

    if (recordedUpdate >= 0 && canonicalUpdate >= 0 
      && (recordedUpdate / canonicalUpdate > 100 || canonicalUpdate / recordedUpdate > 100)) {
      console.error("Comparing seconds and milliseconds for cache refresh check", recordedUpdate, canonicalUpdate);
    }
    
    // upload if it doesn't exist or the cache is stale
    if (!(await this.cacheExists()) 
      || recordedUpdate < canonicalUpdate
    ) {
      await this.uploadToCache();
      await this.registerCache();
    }

    await this.pullFromCache();
  }

  protected async getRecordedUpdateTime(): Promise<number> {
    const exists = await dataSource.getRepository(Cache).findOneBy({
      hpc: this.hpcName,
      hpcPath: this.cachePath
    });

    if (exists === null) {
      return -1;
    } else {
      return exists.updatedAt.getTime();
    }
  }

  protected async registerCache() {
    if (this.isComplete && !this.isFailed) {
      const exists = await dataSource.getRepository(Cache).findOneBy({
        hpc: this.hpcName,
        hpcPath: this.cachePath
      });

      if (exists === null) {
        const cache = new Cache();
        cache.hpc = this.hpcName;
        cache.hpcPath = this.cachePath;
      
        await dataSource.getRepository(Cache).save(cache);
      } else {
        exists.update();
      }
    }
    
  }
}

/**
 * Specialization of CachedFolderUploader for uploading a folder via Globus while supporting caching.
 * 
 * TODO: figure out how to actually do this and if it is worthwhile (e.g., do users usually run on the same data multiple times); would need to globus, then cp
 * initially
 */
class GlobusFolderUploader extends CachedFolderUploader {  // eslint-disable-line
  private from: GlobusFolder;
  private to: GlobusFolder;

  private taskId!: string;
  private jobId: string;

  constructor(
    from: GlobusFolder,
    hpcName: string,
    userId: string,
    jobId: string
  ) {
    // TODO: make this more robust to handle arbitrar globus paths
    // path/to/root/path/to/localfolder -> path-to-root-path-to-localfolder
    const cachePath = from.path.replace(/[/\\]/g, "-").replace("~", "base").replace(" ", "").replace(".", "dot");
    super(cachePath, hpcName, userId);

    if (!this.hpcConfig)
      throw new Error(`cannot find hpcConfig with name ${hpcName}`);

    this.from = from;
    this.to = {
      type: "globus",
      endpoint: this.hpcConfig.globus.endpoint,
      path: this.globusPath!,  // will not be null for globus folder uploads (probably)
    };

    this.jobId = jobId;
  }

  /**
   * Helper wrapper function for performing a globus transfer to a given folder. Used in both the 
   * cached and non-cached versions of functions.
   *
   * @param {GlobusFolder} folder
   */
  protected async uploadToFolder(folder: GlobusFolder) {
    const taskId = await GlobusClient.initTransfer(
      this.from,
      folder,
      "job-id-" + this.jobId + "-upload-folder-" + this.id
    );

    this.taskId = taskId;

    // get status of transfer
    const status = await GlobusClient.monitorTransfer(
      this.taskId,
    );

    if (status.includes("FAILED")) {
      this.isComplete = true;
      this.isFailed = true;
    }

    if (status.includes("SUCCEEDED")) {
      this.isComplete = true;
    }    
  }

  /**
   * Uploads the specified folder to the target folder via globus.
   *
   */
  public async upload() {
    // start the transfer
    await this.uploadToFolder(this.to);
    await this.register();
  }

  /**
   * Uploads the specified folder to the cache via globus.
   *
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async uploadToCache(): Promise<void> {
    // need some way to detect cache invalidation
    throw new NotImplementedError("Not implemented");
    // Helper.nullGuard(this.hpcConfig.globus);  // know this is defined from the constructor

    // const uploadPath = this.cachePath.slice(0, -3);
    // await this.uploadToFolder({
    //   endpoint: this.hpcConfig.globus.endpoint,  
    //   path: uploadPath, // get rid of the .zip
    //   type: "globus"
    // });

    // await this.connector.zip(uploadPath, this.cachePath);
    // await this.connector.rm(uploadPath);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getCanonicalUpdateTime(): Promise<number> {
    throw new NotImplementedError("Not implemented");
  }
}

/**
 * Specialization of BaseFolderUploader for uploading a local folder.
 */
export class LocalFolderUploader extends CachedFolderUploader {
  protected localPath: string; 

  constructor(
    from: LocalFolder,
    hpcName: string,
    userId: string,
    connector: Connector | null = null
  ) {
    const parts = from.localPath.split("/");
    super(parts[parts.length - 1], hpcName, userId);
    this.localPath = from.localPath;
    this.connector = connector ?? new BaseConnector(hpcName);
  }

  /**
   * Helper function for uploading a folder to a specified path. Used for both the normal and cached
   * versions of the upload comman.d
   *
   * @param {string} path
   */
  protected async uploadToPath(path: string) {
    // if path does not exist, throw an error
    if (!fs.existsSync(this.localPath)) {
      throw new Error(`could not find folder under path ${this.localPath}`);
    }

    // zip the folder
    const from = await FolderUtil.getZip(this.localPath);

    // upload via connector and SCP/slurm
    await this.connector.upload(from, path, false, false);
    // remove the zipped file on the local machine
    await FolderUtil.removeZip(from);

    // register upload in database & mark complete
    this.isComplete = true;
  }

  /**
   * Uploads the specified local path to the HPC via SCP.
   *
   * @throws {Error} path needs to be valid
   */
  public async upload() {
    await this.uploadToPath(this.hpcPath);

    await this.register();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async uploadToCache(): Promise<void> {
    // need some way to detect cache invalidation
    throw new NotImplementedError("Not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getCanonicalUpdateTime(): Promise<number> {
    throw new NotImplementedError("Not implemented");
  }
}

/**
 * Specialization of LocalFolderUploader for uploading a git folder (on the local machine).
 * Always uploads the most updated version.
 * 
 * TODO: verify this cached version actually works
 */
export class GitFolderUploader extends LocalFolderUploader   {
  private gitId: string;

  constructor(
    from: GitFolder,
    hpcName: string,
    userId: string,
    connector: Connector | null = null
  ) {
    const localPath: string = GitUtil.getLocalPath(from.gitId);
    
    super({ type: "local", localPath }, hpcName, userId, connector);
    this.gitId = from.gitId;
  }

  protected async getCanonicalUpdateTime(): Promise<number> {
    const git = await GitUtil.findGit(this.gitId);

    if (!git) {
      throw Error("Could not find git repository to upload.");
    }

    return (await GitUtil.getLastCommitTime(git)) * 1000;
  }

  protected async uploadToCache() {
    await this.uploadToPath(this.cachePath);

    await this.register();
  }
}

/**
 * Helper class/method for uploading a generic file, 
 * returning the proper folder uploader as required.
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
    from: BaseFolder,
    hpcName: string,
    userId: string,
    jobId = "",
    connector: Connector | null = null
  ): Promise<BaseFolderUploader> {

    let uploader: BaseFolderUploader;
    switch (from.type) {
    case "git":
      uploader = new GitFolderUploader(
        from as GitFolder,
        hpcName,
        userId,
        connector
      );
      await uploader.upload();
      break;

    case "local":
      uploader = new LocalFolderUploader(
        from as LocalFolder,
        hpcName,
        userId,
        connector
      );
      await uploader.upload();
      break;

    case "globus":
      uploader = new GlobusFolderUploader(
        from as GlobusFolder, 
        hpcName, 
        userId, 
        jobId
      );

      await uploader.upload();
      break;

    case "empty":
      Helper.nullGuard(connector);
      
      uploader = new EmptyFolderUploader(hpcName, userId, jobId, connector);
      await uploader.upload();
      break;
    }

    return uploader;
  }

  /**
   * Uploads a generic folder and returns the helper used to do so. Uses the cached versions of everything.
   * Only supported for git folders currently.
   *
   * @static
   * @param {NeedUploadFolder} from either a GlobusFolder, GitFolder, or LocalFolder
   * @param {string} hpcName name of hpc to uplaod to
   * @param {string} userId current user
   * @param {Connector} [connector=null] connector to connect to HPC with, if needed
   * @throws {Error} invalid file type/format
   * @return {Promise<BaseFolderUploader>} folder uploader object used to upload the folder, can check if upload was successful via {uploader}.isComplete
   */
  static async cachedUploadGit(
    from: GitFolder,
    hpcName: string,
    userId: string,
    connector: Connector | null = null
  ): Promise<CachedFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new Error("invalid local file format");

    const uploader = new GitFolderUploader(
      from,
      hpcName,
      userId,
      connector
    );

    await uploader.init();
    await uploader.cachedUpload();

    return uploader;
  }
}