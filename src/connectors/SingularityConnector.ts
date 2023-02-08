import SlurmConnector from "./SlurmConnector";
import { slurm, executableManifest } from "../types";
import { containerConfigMap, hpcConfigMap, kernelConfigMap} from "../../configs/config";
import * as path from "path";

class SingularityConnector extends SlurmConnector {
  /**
   * Connects the singularity container to the hpc enivironment
   */
  private volumeBinds: { [keys: string]: string } = {};

  public isContainer = true;

  /**
   * Executes specified command within specified image
   *
   * @param{string} image - docker image
   * @param{string} cmd - command to be executed
   * @param{slurm} config - slurm configuration
   */
  execCommandWithinImage(image: string, cmd: string, config: slurm) {
    if (this.is_cvmfs){
      cmd = `srun --mpi=pmi2 singcvmfs -s exec ${this._getVolumeBindCMD()} -cip docker://alexandermichels/compute-cvmfs:0.0.4 ${cmd}`;
    }
    else{
      cmd = `srun --mpi=pmi2 singularity exec ${this._getVolumeBindCMD()} ${image} ${cmd}`;
    }
    super.prepare(cmd, config);
  }

  /**
   * Executes specified manifest within image
   *
   * @param{executableManifest} manifest - manifest that needs toe be executed
   * @param{slurm} config - slurm configuration
   * @throw{Error} - thrown when container is not supported
   */
  execExecutableManifestWithinImage(
    manifest: executableManifest,
    config: slurm
  ) {
    if(!this.is_cvmfs){
      var container = containerConfigMap[manifest.container];
      if (!container) throw new Error(`unknown container ${manifest.container}`);
      var containerPath = container.hpc_path[this.hpcName];
      if (!containerPath)
        throw new Error(
          `container ${manifest.container} is not supported on HPC ${this.hpcName}`
        );
      // remove buffer: https://dashboard.hpc.unimelb.edu.au/job_submission/
    }

    var jobENV = this._getJobENV();
    var cmd = ``;

    if (manifest.pre_processing_stage_in_raw_sbatch) {
      for (var i in manifest.pre_processing_stage_in_raw_sbatch) {
        cmd += `${manifest.pre_processing_stage_in_raw_sbatch[i]}\n`;
      }
    } else if (manifest.pre_processing_stage) {
      if (this.is_cvmfs){
        cmd += `${jobENV.join(
          " "
        )} singcvmfs -s exec ${this._getVolumeBindCMD()} -cip  bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${
          manifest.pre_processing_stage
        }\"\n\n`;
      }
      else{
        cmd += `${jobENV.join(" ")} singularity exec ${this._getVolumeBindCMD(
          manifest
        )} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${
          manifest.pre_processing_stage
        }\"\n\n`;
      }
    }

    if (manifest.execution_stage_in_raw_sbatch) {
      for (var i in manifest.execution_stage_in_raw_sbatch) {
        cmd += `${manifest.execution_stage_in_raw_sbatch[i]}\n`;
      }
    } else {
      if (this.is_cvmfs){
        this.createBashScript(manifest);
        cmd += `${jobENV.join(
          " "
        )} srun --unbuffered --mpi=pmi2 singcvmfs -s exec ${this._getVolumeBindCMD()} -cip docker://alexandermichels/compute-cvmfs:0.0.4 bash -c \"cd ${this.getContainerExecutableFolderPath()} && bash kernel_init.sh && ${
          manifest.execution_stage
        }"\n\n`;
      }
      else{
        cmd += `${jobENV.join(
          " "
        )} srun --unbuffered --mpi=pmi2 singularity exec ${this._getVolumeBindCMD(
          manifest
        )} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${
          manifest.execution_stage
        }"\n\n`;
      }
    }

    if (manifest.post_processing_stage_in_raw_sbatch) {
      for (var i in manifest.post_processing_stage_in_raw_sbatch) {
        cmd += `${manifest.post_processing_stage_in_raw_sbatch[i]}\n`;
      }
    } else if (manifest.post_processing_stage) {
      if(this.is_cvmfs){
        cmd += `${jobENV.join(
          " "
        )} singcvmfs -s exec ${this._getVolumeBindCMD()} -cip docker://alexandermichels/compute-cvmfs:0.0.4 bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${
          manifest.post_processing_stage
        }\"`;
      }
      else{
        cmd += `${jobENV.join(" ")} singularity exec ${this._getVolumeBindCMD(
          manifest
        )} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${
          manifest.post_processing_stage
        }\"`;
      }

    }

    super.prepare(cmd, config);
  }

  /**
   * Runs singularity image
   *
   * @param{string} image - singularity image
   * @param{slurm} config - slurm configuration
   */
  runImage(image: string, config: slurm) {
    var jobENV = this._getJobENV();
    if (this.is_cvmfs){
      var cmd = `srun --mpi=pmi2 ${jobENV.join(
        " "
      )} singcvmfs -s exec ${this._getVolumeBindCMD()} -cip ${image}`;
    }
    else{
      var cmd = `srun --mpi=pmi2 ${jobENV.join(
        " "
      )} singularity run ${this._getVolumeBindCMD()} ${image}`;
    }
    super.prepare(cmd, config);
  }

  /**
   * Registers volumeBinds
   *
   * @param{{[keys: string]: string}} volumeBinds - volumeBinds that need to be registered
   */
  registerContainerVolumeBinds(volumeBinds: { [keys: string]: string }) {
    for (var from in volumeBinds) {
      var to = volumeBinds[from];
      this.volumeBinds[from] = to;
    }
  }

  /**
   * Returns volumeBinds
   *
   * @param{executableManifest} manifest - manifest containing volumeBinds
   * @return{{[keys: string]: string}} volumeBinds
   */
  private _getVolumeBindCMD(manifest: executableManifest | null = null) {
    if (this.is_cvmfs){
      this.volumeBinds[`$tmp_path`] = this.getContainerCVMFSFolderPath();
    }
    this.volumeBinds[this.getRemoteExecutableFolderPath()] =
      this.getContainerExecutableFolderPath();
    this.volumeBinds[this.getRemoteResultFolderPath()] =
      this.getContainerResultFolderPath();
    if (this.getRemoteDataFolderPath()) {
      this.volumeBinds[this.getRemoteDataFolderPath()] =
        this.getContainerDataFolderPath();
    }

    if (manifest) {
      if (!this.is_cvmfs){
        var hpc = hpcConfigMap[this.hpcName];
        if (hpc) {
          if (hpc.mount) {
            for (var i in hpc.mount){
              this.volumeBinds[i] = hpc.mount[i];
            }
          }
        }
      }
      if (!this.is_cvmfs){
      var container = containerConfigMap[manifest.container];
      if (container) {
        if (container.mount) {
          if (container.mount[this.hpcName]) {
            for (var i in container.mount[this.hpcName]) {
              this.volumeBinds[i] = container.mount[this.hpcName][i];
            }
          }
        }
      }
    }
    }

    var bindCMD: Array<string> = [];
    for (var from in this.volumeBinds) {
      var to = this.volumeBinds[from];
      bindCMD.push(`${from}:${to}`);
    }
    if (this.is_cvmfs){
      return `-B ${bindCMD.join(",")}`;
    }
    else{
      return `--bind ${bindCMD.join(",")}`;
    }
  }

  /**
   * Returns job environment
   *
   * @return{string[]} jobENV - jobenvironment variables
   */
  private _getJobENV(): string[] {
    var jobJSON = {
      job_id: this.maintainer.job.id,
      user_id: this.maintainer.job.userId,
      maintainer: this.maintainer.job.maintainer,
      hpc: this.maintainer.job.hpc,
      param: this.maintainer.job.param,
      env: this.maintainer.job.env,
      executable_folder: this.isContainer
        ? this.getContainerExecutableFolderPath()
        : this.getRemoteExecutableFolderPath(),
      data_folder: this.isContainer
        ? this.getContainerDataFolderPath()
        : this.getRemoteDataFolderPath(),
      result_folder: this.isContainer
        ? this.getContainerResultFolderPath()
        : this.getRemoteResultFolderPath(),
    };

    var jobENV = [];
    for (var key in jobJSON) {
      var structuredKeys = ["param", "env"];
      if (structuredKeys.includes(key)) {
        for (var i in jobJSON[key]) {
          jobENV.push(`${key}_${i}="${jobJSON[key][i]}"`);
        }
      } else {
        jobENV.push(`${key}="${jobJSON[key]}"`);
      }
    }

    return jobENV;
  }

  /**
   * Creates a bash script using kernelConfig
   * @param{executableManifest} manifest - manifest that needs toe be executed
   */
  async createBashScript(manifest: executableManifest){
    var kernelBash = `!/bin/bash
    ${kernelConfigMap[manifest.container].env.join("\n")}`
  
    await this.createFile(
      kernelBash,
      path.join(this.getRemoteExecutableFolderPath(), "kernel_init.sh")
    );
  }
}

export default SingularityConnector;
