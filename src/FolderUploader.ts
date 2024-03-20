import * as fs from "fs";
import * as path from "path";
import { hpcConfigMap } from "../configs/config";
import BaseConnector from "./connectors/BaseConnector";
import SingularityConnector from "./connectors/SingularityConnector";
import SlurmConnector from "./connectors/SlurmConnector";
import DB from "./DB";
import FolderUtil from "./lib/FolderUtil";
import GitUtil from "./lib/GitUtil";
import GlobusUtil from "./lib/GlobusUtil";
import * as Helper from "./lib/Helper";
import { Folder } from "./models/Folder";
import { Git } from "./models/Git";
import {
  AnyFolder,
  GitFolder,
  GlobusFolder,
  hpcConfig,
  LocalFolder,
  NeedUploadFolder,
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

  protected db: DB;
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
    this.db = new DB();
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
    const connection = await this.db.connect();
    const folder = new Folder();
    folder.id = this.id;
    folder.hpcPath = this.hpcPath;
    if (this.globusPath) {
      folder.globusPath = this.globusPath;
    }
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
    await this.register();  // register folder in the database
    this.isComplete = true;
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
  protected cacheFile: string;

  constructor(
    cacheFile: string,
    hpcName: string,
    userId: string,
    connector?: Connector,
  ) {
    super(hpcName, userId, connector);
    
    this.cacheFile = `${cacheFile}.zip`;  // always store cached files as a zip file (TODO: figure out if this is the best for globus)
    
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

  protected getCacheFile(): string {
    return path.join(this.hpcConfig.root_path, "cache", this.cacheFile);
  }

  private async cacheExists(): Promise<boolean> {
    return this.connector.remoteFsExists(this.getCacheFile());
  }

  private async clearCache() {
    if (!(await this.cacheExists())) {
      return;
    }

    await this.connector.rm(this.getCacheFile());
  }

  private async pullFromCache() {
    // assert cached file exists
    await this.connector.unzip(this.getCacheFile(), this.hpcPath);
  }

  protected abstract uploadToCache(): Promise<void>;

  public async refreshCache() {
    await this.clearCache();

    await this.uploadToCache();
  }

  public async cachedUpload() {
    if (!(await this.cacheExists())) {
      await this.refreshCache();
    }

    // await this.register();  // TODO: reenable this and mark it as cached somehow
    await this.pullFromCache();
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

  private taskId: string;
  private jobId: string;

  public globusPath: string;  // cannot be null here

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
   * Helper wrapper function for performing a globus transfer to a given folder. Used in both the 
   * cached and non-cached versions of functions.
   *
   * @param {GlobusFolder} folder
   */
  protected async uploadToFolder(folder: GlobusFolder) {
    this.taskId = await GlobusUtil.initTransfer(
      this.from,
      folder,
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

  /**
   * Uploads the specified folder to the target folder via globus.
   *
   */
  public async upload() {
    // start the transfer
    await this.uploadToFolder(this.to);
  }

  /**
   * Uploads the specified folder to the cache via globus.
   *
   */
  protected async uploadToCache(): Promise<void> {
    Helper.nullGuard(this.hpcConfig.globus);  // know this is defined from the constructor

    const uploadPath = this.getCacheFile().slice(0, -3);
    await this.uploadToFolder({
      endpoint: this.hpcConfig.globus.endpoint,  
      path: uploadPath // get rid of the .zip
    });

    await this.connector.zip(uploadPath, this.getCacheFile());
    await this.connector.rm(uploadPath);
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
    if (this.localPath === undefined || !fs.existsSync(this.localPath)) {
      throw new Error(`could not find folder under path ${this.localPath}`);
    }

    // zip the folder
    const from = await FolderUtil.getZip(this.localPath);

    // upload via connector and SCP/slurm
    await this.connector.upload(from, path, false, false);
    // remove the zipped file on the local machine
    await FolderUtil.removeZip(from);

    // register upload in database & mark complete
    await this.register();
    this.isComplete = true;
  }

  /**
   * Uploads the specified local path to the HPC via SCP.
   *
   * @throws {Error} path needs to be valid
   */
  public async upload() {
    await this.uploadToPath(this.hpcPath);
  }

  protected async uploadToCache(): Promise<void> {
    await this.uploadToPath(this.getCacheFile());
  }
}

/**
 * Specialization of LocalFolderUploader for uploading a git folder (on the local machine).
 * 
 * TODO: verify this cached version actually works
 */
export class GitFolderUploader extends LocalFolderUploader   {
  private gitId: string;
  private git: Git; 

  constructor(
    from: GitFolder,
    hpcName: string,
    userId: string,
    connector: Connector | null = null
  ) {
    const localPath: string = GitUtil.getLocalPath(from.gitId);
    
    super({ localPath }, hpcName, userId, connector);
    this.gitId = from.gitId;
  }

  public async uploadToPath(path: string) {
    // try to find the git repo in the database
    const connection = await this.db.connect();
    const gitRepo = connection.getRepository(Git);

    const foundGit = await gitRepo.findOne(this.gitId);
    if (!foundGit) {
      throw new Error(`cannot find git repo with id ${this.gitId}`);
    }
    this.git = foundGit;

    // repull git if old, then upload (via SCP)
    await GitUtil.refreshGit(this.git);  // unneeded if can guarantee we are good
    await super.uploadToPath(path);
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
    from: AnyFolder,
    hpcName: string,
    userId: string,
    jobId = "",
    connector: Connector | null = null
  ): Promise<BaseFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new Error("invalid local file format");

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

    default:
      throw new Error("undefined file type " + from.type);
    }

    return uploader;
  }

  /**
   * Uploads a generic folder and returns the helper used to do so. Uses the cached versions of everything.
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
  static async  cachedUpload(
    from: NeedUploadFolder,
    hpcName: string,
    userId: string,
    jobId = "",
    connector: Connector | null = null
  ): Promise<CachedFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new Error("invalid local file format");

    let uploader: CachedFolderUploader;
    switch (from.type) {
    case "git":
      uploader = new GitFolderUploader(
        from as GitFolder,
        hpcName,
        userId,
        connector
      );
      
      break;

    case "local":
      uploader = new LocalFolderUploader(
        from as LocalFolder,
        hpcName,
        userId,
        connector
      );

      break;

    case "globus":
      uploader = new GlobusFolderUploader(
        from as GlobusFolder, 
        hpcName, 
        userId, 
        jobId
      );
      
      break;

      // case "empty":
      // Helper.nullGuard(connector);
      
      // uploader = new EmptyFolderUploader(hpcName, userId, jobId, connector);
      // await uploader.upload();
      // break;

    default:
      throw new Error("undefined file type " + from.type);
    }

    await uploader.init();
    await uploader.cachedUpload();

    return uploader;
  }

  /**
   * Refreshes the remote cache for a given cache entry.
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
  static async cacheRefresh(
    from: NeedUploadFolder,
    hpcName: string,
    userId: string,
    jobId = "",
    connector: Connector | null = null
  ): Promise<CachedFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new Error("invalid local file format");

    let uploader: CachedFolderUploader;
    switch (from.type) {
    case "git":
      uploader = new GitFolderUploader(
        from as GitFolder,
        hpcName,
        userId,
        connector
      );
      
      break;

    case "local":
      uploader = new LocalFolderUploader(
        from as LocalFolder,
        hpcName,
        userId,
        connector
      );

      break;

    case "globus":
      uploader = new GlobusFolderUploader(
        from as GlobusFolder, 
        hpcName, 
        userId, 
        jobId
      );
      
      break;

      // case "empty":
      // Helper.nullGuard(connector);
      
      // uploader = new EmptyFolderUploader(hpcName, userId, jobId, connector);
      // await uploader.upload();
      // break;

    default:
      throw new Error("undefined file type " + from.type);
    }

    await uploader.init();
    await uploader.refreshCache();

    return uploader;
  }
}