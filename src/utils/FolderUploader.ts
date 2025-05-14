

import * as fs from "fs";
import { stat } from "fs/promises";
import * as path from "path";

import { hpcConfigMap } from "../../configs/config";
import { SSHConnector } from "../connectors";
import {
  BaseFolder,
  GitFolder,
  GlobusFolder,
  hpcConfig,
  LocalFolder,
} from "../definitions";
import GitUtil from "../helpers/GitUtil";
import { GlobusClient } from "../helpers/GlobusTransferUtil";
import * as Helper from "../helpers/Helper";
import { isDirectory, isZipped } from "../helpers/LocalFolderUtil";
import { Cache, Folder } from "../models";

import dataSource from "./DB";

/**
 * Base class for encapsulating information about a folder upload.
 */
export class BaseFolderUploader {
  // details about the current HPC/user this uploader pertains to
  public id: string;  // unique id for the uploader
  public hpcPath: string;
  public hpcName: string;
  public userId: string;
  public hpcConfig: hpcConfig;
  public jobId: string;
  public connector: SSHConnector;

  /**
   *
   * @param hpcName name of the hpc to upload to
   * @param userId user uploading the files
   * @param connector connector to interface with the hpc via ssh
   * @param jobId job this upload is for
   * @throws {ReferneceError} if unable to resolve config for the hpc
   */
  constructor(hpcName: string, userId: string, connector: SSHConnector, jobId: string) {
    this.hpcName = hpcName;
    this.hpcConfig = hpcConfigMap[hpcName];
    if (!this.hpcConfig)
      throw new ReferenceError(`cannot find hpcConfig with name ${hpcName}`);

    this.id = Helper.generateId();
    this.userId = userId;
    
    this.hpcPath = path.join(this.hpcConfig.root_path, this.id);
    this.jobId = jobId;

    this.connector = connector;
  }

  /**
   * Registers an uploaded folder for a particular job in the Folder database.
   */
  async register() {
    const folder = new Folder();
    folder.id = this.id;
    folder.hpcPath = this.hpcPath;
    if (this.hpcConfig.globus) {
      folder.globusPath = path.join(this.hpcConfig.globus.root_path, this.id) ;
    }
    folder.hpc = this.hpcName;
    folder.userId = this.userId;
  
    await dataSource.getRepository(Folder).save(folder);
  }
}

/**
 * This folder uploader adds the capability to cache results on the HPC to avoid having to rezip, rescp-globus, and unzip things
 * everytime a new job with the same inputs are created. Essentially, all uploaded zip files are stored, and the cache is checked
 * upon any folder upload If the cache contains the desired file, just unzip it from there and skip any folder uploading logic.
 *
 * TODO: if the paths stay the same, it will still used the cache version (which might be okay, just have refresh path)
 */
class CachedFolderUploader extends BaseFolderUploader {
  public cachePath!: string;

  /**
   * Initializes the cached folder uploader by creating the cache directory at the root path. 
   * Must be called before using the uploader for absolute safety, but it only needs to be
   * called once ever (unless the scratch space is wiped)
   * @param cacheFile name of this particular file in the cache
   */
  public async init(cacheFile: string) {
    // initialize cache if it does not exist
    const cacheRoot = path.join(this.hpcConfig.root_path, "cache");
    if (!(await this.connector.remoteFsExists(cacheRoot))) {
      await this.connector.mkdir(cacheRoot);
    }

    this.cachePath = path.join(this.hpcConfig.root_path, "cache", `${cacheFile}.zip`);
  }

  /**
   * Determines whether a cached directory actually exists on a remote HPC.
   * @private
   * @returns true if the directory exists, false otherwise
   */
  public async cacheExists(): Promise<boolean> {
    return this.connector.remoteFsExists(this.cachePath);
  }

  /**
   * Explicitly removes a remote cached directory, if it exists.
   * @private
   */
  public async clearCache() {
    if (!(await this.cacheExists())) {
      return;
    }

    await this.connector.rm(this.cachePath);
  }

  /**
   * Unzips a cached zip file to the hpc path, where it will be used in jobs.
   * @private
   */
  public async pullFromCache() {
    // assert cached file exists
    await this.connector.unzip(this.cachePath, this.hpcPath);
  }

  /**
   * Get the last time this cached file was updated on the HPC. 
   * @returns recorded update time in the database
   */
  public async getRecordedUpdateTime(): Promise<number> {
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

  /**
   * Registers an upload to the cache on a HPC for update-tracking purposes. 
   */
  async registerCache() {
    const exists = await dataSource.getRepository(Cache).findOneBy({
      hpc: this.hpcName,
      hpcPath:  this.cachePath
    });
  
    if (exists === null) {
      const cache = new Cache();
      cache.hpc =  this.hpcName;
      cache.hpcPath =  this.cachePath;
      
      await dataSource.getRepository(Cache).save(cache);
    } else {
      exists.update();
    }
  }
}



/**
 * Uploads an empty folder.
 * @param base given parameters for the uploaded folder
 */
async function emptyFolderUpload(base: BaseFolderUploader) {
  await base.connector.mkdir(base.hpcPath, {}, true);
  await base.register();
}

/**
 *
 * @param base  given parameters for the uploaded folder
 * @param from source folder to upload
 * @throws {Error} if globus file transfer failed
 */
async function globusFolderUpload(base: BaseFolderUploader, from: GlobusFolder) {
  const taskId = await GlobusClient.initTransfer(
    from,
    {
      type: "globus",
      endpoint: base.hpcConfig.globus.endpoint,
      path: path.join(base.hpcConfig.globus.root_path, base.id) ,  // will not be null for globus folder uploads (probably)
    },
    "job-id-" + base.jobId + "-upload-folder-" + base.id
  );

  const status = await GlobusClient.monitorTransfer(
    taskId,
  );

  if (status.includes("FAILED")) {
    throw new Error("unable to transfer file via globus to HPC");
  } else if (status.includes("SUCCEEDED")) {
    await base.register();
  }
}

/**
 * Uploads a data folder
 * @param base  given parameters for the uploaded folder
 * @param from source folder to upload
 * @throws {Error} if file to transfer does not exist on file system
 */
async function localFolderUpload(base: BaseFolderUploader, from: LocalFolder) {
  if (!fs.existsSync(from.localPath)) {
    throw new Error(`could not find folder under path ${from.localPath}`);
  }

  if (await isDirectory(from.localPath)) {
    const zipPath = `${base.hpcPath}.zip`;
    await base.connector.uploadFolderZip(from.localPath, zipPath, false);
    await base.connector.unzip(zipPath, base.hpcPath);
    void base.connector.rm(zipPath);
  } else {
    const remoteFilePath = path.join(base.hpcPath, path.basename(from.localPath));
    await base.connector.mkdir(base.hpcPath);
    await base.connector.uploadFile(from.localPath, remoteFilePath, false);

    if (await isZipped(from.localPath)) {
      await base.connector.unzip(remoteFilePath, base.hpcPath);
      void base.connector.rm(remoteFilePath);
    }
  }

  await base.register();
}

/**
 *
 * @param base  given parameters for the uploaded folder
 * @param from source folder to upload
 * @throws {Error} if git repository does not exist locally
 */
async function gitFolderUpload(base: BaseFolderUploader, from: GitFolder) {
  const localPath = GitUtil.getLocalPath(from.gitId);
  await localFolderUpload(base, { localPath, type: "local" });
}

/**
 *
 * @param base  given parameters for the uploaded folder
 * @param from source folder to upload
 * @throws {Error} if the git repository to upload is not registered in the database
 */
async function gitFolderUploadCached(base: CachedFolderUploader, from: GitFolder) {
  const localPath = GitUtil.getLocalPath(from.gitId);
  const git = await GitUtil.findGit(from.gitId);

  if (!git) {
    throw new Error("unable to find the git repository to upload");
  }

  await base.init(from.gitId);

  const recordedUpdate = (await GitUtil.getLastCommitTime(git)) * 1000;
  const canonicalUpdate = await base.getRecordedUpdateTime();

  if (recordedUpdate >= 0 && canonicalUpdate >= 0 
    && (recordedUpdate / canonicalUpdate > 100 || canonicalUpdate / recordedUpdate > 100)) {
    console.error("Comparing seconds and milliseconds for cache refresh check", recordedUpdate, canonicalUpdate);
  }

  // upload if it doesn't exist or the cache is stale
  if (!(await base.cacheExists()) 
    || recordedUpdate < canonicalUpdate
  ) {
    await base.connector.uploadFolderZip(localPath, base.cachePath, false);
    await base.registerCache();
  }

  await base.pullFromCache();
  await base.register();
}

/**
 * Helper class/method for uploading a generic file, 
 * returning the proper folder uploader as required.
 */
export class FolderUploaderHelper {

  /**
   * Uploads a generic folder and returns the helper used to do so.
   * @param from either a GlobusFolder, GitFolder, or LocalFolder
   * @param hpcName name of hpc to uplaod to
   * @param userId current user
   * @param connector connector to connect to HPC with, if needed
   * @param jobId job associated with the folder upload (optional)
   * @throws {Error} invalid file type/format or upload fails
   * @returns folder uploader object used to upload the folder, can check if upload was successful via {uploader}.isComplete
   */
  static async upload(
    from: BaseFolder,
    hpcName: string,
    userId: string,
    connector: SSHConnector,
    jobId: string,
  ): Promise<BaseFolderUploader> {
    const uploader: BaseFolderUploader = new BaseFolderUploader(hpcName, userId, connector, jobId);

    switch (from.type) {
      case "git":
        await gitFolderUpload(uploader, from as GitFolder);
        break;
      case "local":
        await localFolderUpload(uploader, from as LocalFolder);
        break;

      case "globus":
        await globusFolderUpload(uploader, from as GlobusFolder);
        break;

      case "empty":
        await emptyFolderUpload(uploader);
        break;
    }

    return uploader;
  }

  /**
   * Uploads a generic folder and returns the helper used to do so. Uses the cached versions of everything.
   * Only supported for git folders currently.
   * @param from either a GlobusFolder, GitFolder, or LocalFolder
   * @param hpcName name of hpc to uplaod to
   * @param userId current user
   * @param connector connector to connect to HPC with, if needed
   * @param jobId id of the job
   * @throws {Error} invalid file type/format or upload failed
   * @returns folder uploader object used to upload the folder, can check if upload was successful via {uploader}.isComplete
   */
  static async cachedUploadGit(
    from: GitFolder,
    hpcName: string,
    userId: string,
    connector: SSHConnector,
    jobId: string,
  ): Promise<CachedFolderUploader> {
    // if type not specified, throw an error
    if (!from.type) throw new RangeError("invalid local file format");

    const uploader = new CachedFolderUploader(
      hpcName,
      userId,
      connector,
      jobId
    );

    await gitFolderUploadCached(uploader, from);

    return uploader;
  }
}