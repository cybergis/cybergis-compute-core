import { ConnectorError } from "../errors";
import BaseConnector from "./BaseConnector";
import { slurm } from "../types";
import * as path from "path";
import { config } from "../../configs/config";
import { FolderUploaderHelper } from "../FolderUploader";

class SlurmConnector extends BaseConnector {
  x;
  public slurm_id: string;

  public modules: Array<string> = [];

  public template: string;

  public isContainer = false;

  /**
   * Registers all of the specified modules
   *
   * @param{Array} modules - Array of strings
   */
  registerModules(modules: Array<string>) {
    this.modules = this.modules.concat(modules);
  }

  /**
   * Creates slurm string with specified configuation
   *
   * @param{string} cmd - command that needs to be executed
   * @param{slurm} config - slurm configuration
   */
  async prepare(cmd: string, config: slurm) {
    // prepare sbatch script
    config = Object.assign(
      {
        time: "01:00:00",
        num_of_task: 1,
        cpu_per_task: 1,
      },
      config
    );

    var modules = ``;
    if (config.modules)
      for (var i in config.modules)
        modules += `module load ${config.modules[i]}\n`;
    // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
    this.template = `#!/bin/bash
#SBATCH --job-name=${this.jobId}
${
  this.config.init_sbatch_options
    ? this.config.init_sbatch_options.join("\n")
    : ""
}
${config.num_of_node ? `#SBATCH --nodes=${config.num_of_node}` : ""}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --time=${config.time}
#SBATCH --error=${path.join(
      this.remote_result_folder_path,
      "slurm_log",
      "job.stderr"
    )}
#SBATCH --output=${path.join(
      this.remote_result_folder_path,
      "slurm_log",
      "job.stdout"
    )}
${config.cpu_per_task ? `#SBATCH --cpus-per-task=${config.cpu_per_task}` : ""}
${config.memory_per_gpu ? `#SBATCH --mem-per-gpu=${config.memory_per_gpu}` : ""}
${config.memory_per_cpu ? `#SBATCH --mem-per-cpu=${config.memory_per_cpu}` : ""}
${config.memory ? `#SBATCH --mem=${config.memory}` : ""}
${config.gpus ? `#SBATCH --gpus=${config.gpus}` : ""}
${config.gpus_per_node ? `#SBATCH --gpus-per-node=${config.gpus_per_node}` : ""}
${
  config.gpus_per_socket
    ? `#SBATCH --gpus-per-socket=${config.gpus_per_socket}`
    : ""
}
${config.gpus_per_task ? `#SBATCH --gpus-per-task=${config.gpus_per_task}` : ""}
${config.partition ? `#SBATCH --partition=${config.partition}` : ""}
${this.getSBatchTagsFromArray("mail-type", config.mail_type)}
${this.getSBatchTagsFromArray("mail-user", config.mail_user)}
module purge
${
  this.config.init_sbatch_script
    ? this.config.init_sbatch_script.join("\n")
    : ""
}
${modules}
${cmd}`;
  }

  /**
   * @async
   * submited the job
   */
  async submit() {
    // create job.sbatch
    await this.mkdir(path.join(this.remote_result_folder_path, "slurm_log"));
    await this.createFile(
      this.template,
      path.join(this.getRemoteExecutableFolderPath(), "job.sbatch"),
      {},
      true
    );

    // job.json
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
    await this.createFile(
      jobJSON,
      path.join(this.getRemoteExecutableFolderPath(), "job.json")
    );

    // submit
    if (this.maintainer != null)
      this.maintainer.emitEvent("SLURM_SUBMIT", `submitting slurm job`);
    const sbatchResult = await this.exec(
      `sbatch job.sbatch`,
      { cwd: this.getRemoteExecutableFolderPath() },
      true,
      true
    );
    var failed = false;
    if (!sbatchResult.stdout) failed = true;
    else if (
      sbatchResult.stdout.includes("ERROR") ||
      sbatchResult.stdout.includes("WARN")
    )
      failed = true;
    else if (!sbatchResult.stdout.includes("Submitted batch job "))
      failed = true;

    if (failed) {
      if (this.maintainer != null)
        this.maintainer.emitEvent(
          "SLURM_SUBMIT_ERROR",
          "cannot submit job " +
            this.maintainer.id +
            ": " +
            JSON.stringify(sbatchResult)
        );
      throw new ConnectorError(
        "cannot submit job " +
          this.maintainer.id +
          ": " +
          JSON.stringify(sbatchResult)
      );
    }

    this.slurm_id = sbatchResult.stdout.split(/[ ]+/).pop().trim();
    await this.maintainer.updateJob({ slurmId: this.slurm_id });
    if (this.maintainer != null)
      this.maintainer.emitEvent(
        "SLURM_SUBMIT_SUCCESS",
        `slurm job submitted with slurm job id ${this.slurm_id}`
      );
  }

  // qstat:
  // Job id              Name             Username        Time Use S Queue
  // ------------------- ---------------- --------------- -------- - ---------------
  // 3142249             singularity      cigi-gisolve    00:00:00 R node
  //
  // squeue: https://slurm.schedmd.com/squeue.html
  // ['JOBID', 'PARTITION', 'NAME', 'USER', 'ST', 'TIME', 'NODES', 'NODELIST(REASON)']
  // ['3142135', 'node', 'singular', 'cigi-gis', 'R', '0:11', '1', 'keeling-b08']

  /**
   * @async
   * checks job status
   */
  async getStatus() {
    try {
      var squeueResult = await this.exec(
        `squeue --job ${this.slurm_id}`,
        {},
        true,
        true
      );

      if (!squeueResult.stderr && squeueResult.stdout) {
        var r = squeueResult.stdout.split(/[ |\n]+/);
        var i = r.indexOf(this.slurm_id);
        return i >= 0 ? r[i + 4] : "UNKNOWN";
      }

      var qstatResult = await this.exec(
        `qstat ${this.slurm_id}`,
        {},
        true,
        true
      );

      if (qstatResult.stdout) {
        var r = qstatResult.stdout.split(/[ |\n]+/);
        var i = r.indexOf(this.slurm_id);
        return i >= 0 ? r[i + 4] : "UNKNOWN";
      }

      return "RETRY";
    } catch (e) {
      return "RETRY";
    }
  }

  /**
   * @async
   * cancels the job
   */
  async cancel() {
    await this.exec(`scancel ${this.slurm_id}`, {}, true);
  }

  /**
   * @async
   * pauses the job
   */
  async pause() {
    await this.exec(`scontrol suspend ${this.slurm_id}`, {}, true);
  }

  /**
   * @async
   * resumes the job
   */
  async resume() {
    await this.exec(`scontrol resume ${this.slurm_id}`, {}, true);
  }

  /**
   * @async
   * gets SlurmStdOut
   */
  async getSlurmStdout() {
    var out = await this.cat(
      path.join(this.remote_result_folder_path, "slurm_log", "job.stdout"),
      {}
    );
    if (this.maintainer && out) this.maintainer.emitLog(out);
  }

  /**
   * @async
   * gets SlurmStderr
   */
  async getSlurmStderr() {
    var out = await this.cat(
      path.join(this.remote_result_folder_path, "slurm_log", "job.stderr"),
      {}
    );
    if (this.maintainer && out) this.maintainer.emitLog(out);
  }

  /**
   * Get sbatch tags
   *
   * @param{string} tag - sbatch tags
   * @param{string[]} vals - values of sbatch tags
   * @return{string} - sbatch string
   */
  private getSBatchTagsFromArray(tag: string, vals: string[]) {
    if (!vals) return ``;
    var out = ``;
    for (var i in vals) out += `#SBATCH --${tag}=${vals[i]}\n`;
    return out;
  }

  /**
   * Get Container executable folder path
   *
   * @param{string} providedPath - specified path
   * @return{string} - executable path
   */
  getContainerExecutableFolderPath(providedPath: string = null) {
    if (providedPath) return path.join(`/job/executable`, providedPath);
    else return `/job/executable`;
  }

  /**
   * Get Container data folder path
   *
   * @param{string} providedPath - specified path
   * @return{string} - executable path
   */
  getContainerDataFolderPath(providedPath: string = null) {
    if (providedPath) return path.join(`/job/data`, providedPath);
    else return `/job/data`;
  }

  /**
   * Get Container result folder path
   *
   * @param{string} providedPath - specified path
   * @return{string} - executable path
   */
  getContainerResultFolderPath(providedPath: string = null) {
    if (providedPath) return path.join(`/job/result`, providedPath);
    else return `/job/result`;
  }

  /**
   * @async
   * Get remote results folder content
   *
   * @param{string} providedPath - specified path
   * @return{string[]} - file content
   */
  async getRemoteResultFolderContent() {
    var findResult = await this.exec(
      `find . -type d -print`,
      { cwd: this.getRemoteResultFolderPath() },
      true,
      true
    );
    if (config.is_testing && findResult.stderr)
      console.log(JSON.stringify(findResult)); // logging
    if (!findResult.stdout) return [];
    var rawFiles = findResult.stdout.split("\n");
    var files = ["/"];
    for (var i in rawFiles) {
      var t = rawFiles[i].trim();
      if (t[0] == ".") t = t.replace("./", "");
      var rawFile = t.split("/");
      var skipFile = false;
      for (var j in rawFile) {
        if (rawFile[j].startsWith(".")) {
          skipFile = true;
          break;
        } // ignore invisible files
      }
      if (skipFile) continue;
      var filePath = `/${rawFile.join("/")}`;
      if (!files.includes(filePath)) files.push(filePath);
    }
    return files;
  }

  /*
        Job ID: 558556
        Cluster: keeling7
        User/Group: cigi-gisolve/cigi-gisolve-group
        State: COMPLETED (exit code 0)
        Nodes: 2
        Cores per node: 2
        CPU Utilized: 00:00:02
        CPU Efficiency: 16.67% of 00:00:12 core-walltime
        Job Wall-clock time: 00:00:03
        Memory Utilized: 61.45 MB (estimated maximum)
        Memory Efficiency: 0.38% of 16.00 GB (4.00 GB/core)
     */

  /**
   * Get job usage
   *
   * @return{Object} - usage dictionary
   */
  async getUsage() {
    var seffOutput = {
      nodes: null,
      cpus: null,
      cpuTime: null,
      memory: null,
      memoryUsage: null,
      walltime: null,
    };

    try {
      var seffResult = await this.exec(`seff ${this.slurm_id}`, {}, true, true);
      if (seffResult.stderr) return seffOutput;
      var tmp = seffResult.stdout.split("\n");
      //
      for (var i in tmp) {
        var j = tmp[i].split(":");
        var k = j[0].trim();
        j.shift();
        var v = j.join(":").trim();
        //
        switch (k) {
          case "Nodes":
            seffOutput.nodes = parseInt(v);
          case "Cores per node":
            seffOutput.cpus = parseInt(v);
          case "CPU Utilized":
            var l = v.split(":");
            if (l.length != 3) continue;
            var seconds =
              parseInt(l[0]) * 60 * 60 + parseInt(l[1]) * 60 + parseInt(l[2]);
            seffOutput.cpuTime = seconds;
          case "Job Wall-clock time":
            var l = v.split(":");
            if (l.length != 3) continue;
            var seconds =
              parseInt(l[0]) * 60 * 60 + parseInt(l[1]) * 60 + parseInt(l[2]);
            seffOutput.walltime = seconds;
          case "Memory Utilized":
            v = v.toLowerCase();
            var kb = parseFloat(v.substring(0, v.length - 2).trim());
            var units = ["kb", "mb", "gb", "tb", "pb", "eb"];
            var isValid = false;
            for (var i in units) {
              if (v.includes(i)) {
                isValid = true;
                break;
              }
            }
            if (!isValid) continue;
            for (var i in units) {
              var unit = units[i];
              if (v.includes(unit)) break;
              kb = kb * 1024;
            }
            seffOutput.memoryUsage = kb;
          case "Memory Efficiency":
            v = v.toLowerCase();
            var l = v.split("of");
            if (l.length != 2) continue;
            l = l[1].trim().split("(");
            if (l.length != 2) continue;
            v = l[0].trim();
            //
            var kb = parseFloat(v.substring(0, v.length - 2).trim());
            var units = ["kb", "mb", "gb", "tb", "pb", "eb"];
            var isValid = false;
            for (var i in units) {
              if (v.includes(i)) {
                isValid = true;
                break;
              }
            }
            if (!isValid) continue;
            for (var i in units) {
              var unit = units[i];
              if (v.includes(unit)) break;
              kb = kb * 1024;
            }
            seffOutput.memory = kb;
        }
      }
      //
      if (seffOutput.cpus && seffOutput.nodes) {
        seffOutput.cpus = seffOutput.cpus * seffOutput.nodes;
      } else {
        seffOutput.cpus = null;
      }
    } catch {}
    return seffOutput;
  }
}

export default SlurmConnector;
