import SingularityConnector from "../connectors/SingularityConnector";
import BaseMaintainer from "./BaseMaintainer";
import XSEDEUtil from "../lib/XSEDEUtil";
import { ResultFolderContentManager } from "../lib/JobUtil";
import { executableManifest, GitFolder } from "../types";
import GitUtil from "../lib/GitUtil";
import { Git } from "../models/Git";
import { Folder } from "../models/Folder";
import { FolderUploaderHelper } from "../FolderUploader";

export default class CommunityContributionMaintainer extends BaseMaintainer {
  public connector: SingularityConnector;

  public resultFolderContentManager: ResultFolderContentManager =
    new ResultFolderContentManager();

  public executableManifest: executableManifest;

  onDefine() {
    // define connector
    this.connector = this.getSingularityConnector();
  }

  /**
   * On maintainer initialization, set executableManifest, and give it to the connector. Update the event log to reflect the job being initialized or encountering a system error.
   *
   * @async
   */
  async onInit() {
    try {
      const connection = await this.db.connect();

      // upload executable folder
      if (!this.job.localExecutableFolder)
        throw new Error("job.localExecutableFolder is required");
      this.emitEvent("SLURM_UPLOAD_EXECUTABLE", `uploading executable folder`);
      var uploader = await FolderUploaderHelper.upload(
        this.job.localExecutableFolder,
        this.job.hpc,
        this.job.userId,
        this.job.id,
        this.connector
      );
      this.connector.setRemoteExecutableFolderPath(uploader.hpcPath);
      this.job.remoteExecutableFolder = await connection
        .getRepository(Folder)
        .findOne(uploader.id);

      // upload data folder
      if (this.job.localDataFolder) {
        this.emitEvent("SLURM_UPLOAD_DATA", `uploading data folder`);
        uploader = await FolderUploaderHelper.upload(
          this.job.localDataFolder,
          this.job.hpc,
          this.job.userId,
          this.job.id,
          this.connector
        );
        this.connector.setRemoteDataFolderPath(uploader.hpcPath);
        this.job.remoteDataFolder = await connection
          .getRepository(Folder)
          .findOne(uploader.id);
      } else if (this.job.remoteDataFolder) {
        this.connector.setRemoteDataFolderPath(
          this.job.remoteDataFolder.hpcPath
        );
      }

      // create empty result folder
      this.emitEvent("SLURM_CREATE_RESULT", `create result folder`);
      uploader = await FolderUploaderHelper.upload(
        { type: "empty" },
        this.job.hpc,
        this.job.userId,
        this.job.id,
        this.connector
      );
      this.connector.setRemoteResultFolderPath(uploader.hpcPath);
      this.job.remoteResultFolder = await connection
        .getRepository(Folder)
        .findOne(uploader.id);

      // update job
      await this.updateJob({
        remoteDataFolder: this.job.remoteDataFolder,
        remoteExecutableFolder: this.job.remoteExecutableFolder,
        remoteResultFolder: this.job.remoteResultFolder,
      });

      // check if local executable file is git
      const localExecutableFolder = this.job.localExecutableFolder;
      if (localExecutableFolder.type != "git")
        throw new Error(
          "community contribution currently don't accept non-git code"
        );

      // get executable manifest
      const git = await connection
        .getRepository(Git)
        .findOne((localExecutableFolder as GitFolder).gitId);
      if (!git)
        throw new Error("could not find git repo executable in this job");
      this.executableManifest = await GitUtil.getExecutableManifest(git);

      // submit
      await this.connector.execExecutableManifestWithinImage(
        this.executableManifest,
        this.slurm
      );
      await this.connector.submit();
      this.emitEvent(
        "JOB_INIT",
        "job [" + this.id + "] is initialized, waiting for job completion"
      );
      XSEDEUtil.jobLog(this.connector.slurm_id, this.hpc, this.job);
    } catch (e) {
      this.emitEvent(
        "JOB_RETRY",
        "job [" + this.id + "] encountered system error " + e.toString()
      );
    }
  }

  /**
   * If the job is complete, download the results to the remote result file path, and if it encounters an error, update the event log to reflect this.
   *
   * @async
   */
  async onMaintain() {
    try {
      var status = await this.connector.getStatus();
      // failing condition
      if (status == "ERROR" || status == "F" || status == "NF") {
        this.emitEvent(
          "JOB_FAILED",
          "job [" + this.id + "] failed with status " + status
        );
        return;
      }
      // complete condition
      if (status == "C" || status == "CD" || status == "UNKNOWN") {
        // collect logs
        await this.connector.getSlurmStdout();
        await this.connector.getSlurmStderr();
        // update job usage
        this.emitEvent("JOB_ENDED", "job [" + this.id + "] finished");
        const usage = await this.connector.getUsage();
        this.updateJob(usage);
        // submit again to XSEDE
        XSEDEUtil.jobLog(this.connector.slurm_id, this.hpc, this.job); // for backup submit
        // fetch result folder content
        // TODO: make this shorter
        var contents = await this.connector.getRemoteResultFolderContent();
        var defaultResultFolderDownloadablePath =
          this.executableManifest.default_result_folder_downloadable_path;
        if (defaultResultFolderDownloadablePath) {
          // bring default downloadable to front (for frontend display)
          contents.sort((a, b) =>
            a == defaultResultFolderDownloadablePath
              ? -1
              : b == defaultResultFolderDownloadablePath
              ? 1
              : 0
          );
          if (defaultResultFolderDownloadablePath[0] != "/") {
            defaultResultFolderDownloadablePath = `/${defaultResultFolderDownloadablePath}`;
            contents.sort((a, b) =>
              a == defaultResultFolderDownloadablePath
                ? -1
                : b == defaultResultFolderDownloadablePath
                ? 1
                : 0
            );
          }
        }
        await this.resultFolderContentManager.put(this.id, contents);
      }
    } catch (e) {
      this.emitEvent(
        "JOB_RETRY",
        "job [" + this.id + "] encountered system error " + e.toString()
      );
    }
  }

  /**
   * Pause the connector
   */
  async onPause() {
    await this.connector.pause();
  }

  /**
   * Resume the connector
   */
  async onResume() {
    await this.connector.resume();
  }

  /**
   * Cancel the connector
   */
  async onCancel() {
    await this.connector.cancel();
  }
}
