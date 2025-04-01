import * as path from "path";

import { config, hpcConfigMap } from "../../configs/config";
import { ConnectorError } from "../definitions";
import { slurm } from "../definitions";
import * as Helper from "../helpers/Helper";
import BaseMaintainer from "../maintainers/BaseMaintainer";

import { SSHConnector } from "./SSHConnector";

/**
 * Specialization of BaseConnector that, in addition to offering ssh connection, supports slurm connections with the HPC. 
 */
export class SlurmConnector {

  /** parent pointer */
  protected maintainer: BaseMaintainer;

  /** properties */
  protected is_cvmfs: boolean;
  protected remoteExecutableFolderPath!: string;
  protected remoteDataFolderPath!: string;
  protected remoteResultFolderPath!: string;

  public slurm_id!: string;
  protected modules: string[] = [];  // list of modules to load in slurm environment
  protected template!: string;
  protected isContainer = false;

  /** config */
  protected sshConnector: SSHConnector;

  /**
   *
   * @param maintainer maintainer that this connector was created for
   * @param connector sshconnector this connector should use
   * @param is_cvmfs whether this connector is cvmfs
   */
  protected constructor(
    maintainer: BaseMaintainer,
    connector: SSHConnector,
    is_cvmfs = false
  ) {
    this.maintainer = maintainer;
    this.is_cvmfs = is_cvmfs;
    this.sshConnector = connector;
  }

  /**
   * Creates a SlurmConnector, ensuring that the connector is functional while doing so
   * @param maintainer maintainer to create a slurmconnector for
   * @param is_cvmfs whether this connector should be cvmfs
   * @returns the desired connector, or undefined if the construction was unsuccessful
   */
  public static async build(
    maintainer: BaseMaintainer, 
    is_cvmfs = false
  ): Promise<SlurmConnector | undefined> { 
    const connector = await SSHConnector.build(
      maintainer.hpc, 
      maintainer.job, 
      (...args) => maintainer.emitLog(...args),
      (...args) => maintainer.emitEvent(...args),
      maintainer.job.env
    );

    if (connector === undefined) {
      return undefined;
    }

    return new SlurmConnector(maintainer, connector, is_cvmfs);
  }

  /**
   * Registers all of the specified modules
   * @param modules - Array of strings
   */
  public registerModules(modules: string[]) {
    this.modules = this.modules.concat(modules);
  }

  /**
   * Creates slurm string with specified configuation. Saves it to this.template.
   * @param cmd - command that needs to be executed
   * @param config - slurm configuration
   */
  protected prepare(cmd: string, config: slurm) {
    // prepare sbatch script
    const hpc = hpcConfigMap[this.maintainer.job.hpc];
    config = Object.assign(
      {
        time: "01:00:00",
        num_of_task: 1,
        cpu_per_task: 1,
      },
      config
    );

    if (config.allocation == null) {
      config.allocation = hpc.allocation;
    }

    if (config.partition == null) {
      config.partition = hpc.partition;
    }

    let modules = "";
    if (config.modules) {
      for (const module of config.modules)
        modules += `module load ${module}\n`;
    }

    Helper.nullGuard(this.remoteResultFolderPath);
    Helper.nullGuard(config.mail_type);
    Helper.nullGuard(config.mail_user);

    // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
    this.template = `#!/bin/bash
#SBATCH --job-name=${this.maintainer.job.id}
${this.maintainer.hpcSettings.init_sbatch_options
        ? this.maintainer.hpcSettings.init_sbatch_options.join("\n")
        : ""}
${config.num_of_node ? `#SBATCH --nodes=${config.num_of_node}` : ""}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --time=${config.time}
#SBATCH --error=${path.join(this.remoteResultFolderPath, "slurm_log", "job.stderr")}
#SBATCH --output=${path.join(this.remoteResultFolderPath, "slurm_log", "job.stdout")}
${config.cpu_per_task ? `#SBATCH --cpus-per-task=${config.cpu_per_task}` : ""}
${config.memory_per_gpu ? `#SBATCH --mem-per-gpu=${config.memory_per_gpu}` : ""}
${config.memory_per_cpu ? `#SBATCH --mem-per-cpu=${config.memory_per_cpu}` : ""}
${config.memory ? `#SBATCH --mem=${config.memory}` : ""}
${config.gpus ? `#SBATCH --gpus=${config.gpus}` : ""}
${config.gpus_per_node ? `#SBATCH --gpus-per-node=${config.gpus_per_node}` : ""}
${config.gpus_per_socket
        ? `#SBATCH --gpus-per-socket=${config.gpus_per_socket}`
        : ""}
${config.gpus_per_task ? `#SBATCH --gpus-per-task=${config.gpus_per_task}` : ""}
${config.partition ? `#SBATCH --partition=${config.partition}` : ""}
${config.allocation ? `#SBATCH -A ${config.allocation}` : ""}
${this.getSBatchTagsFromArray("mail-type", config.mail_type)}
${this.getSBatchTagsFromArray("mail-user", config.mail_user)}
module purge
${this.maintainer.hpcSettings.init_sbatch_script
        ? this.maintainer.hpcSettings.init_sbatch_script.join("\n")
        : ""}
${modules}
${cmd}`;
  }

  /**
   * 
   * Submit the slurm job.
   * @throws {ConnectorError} when job cannot be submitted or ssh commands fail
   */
  public async submit() {
    // create job.sbatch on HPC
    await this.sshConnector.mkdir(path.join(this.remoteResultFolderPath, "slurm_log"));
    await this.sshConnector.createFile(
      this.template,
      path.join(this.remoteResultFolderPath, "job.sbatch"),
      {},
      true
    );

    // create job.json on HPC
    const jobJSON = {
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

    await this.sshConnector.createFile(
      jobJSON,
      path.join(this.getRemoteExecutableFolderPath(), "job.json")
    );

    // submit slurm job
    if (this.maintainer !== null)
      this.maintainer.emitEvent("SLURM_SUBMIT", "submitting slurm job");

    const sbatchResult = await this.sshConnector.exec(
      "sbatch job.sbatch",
      { cwd: this.getRemoteExecutableFolderPath() },
      true,
      true
    );

    // check if the sbatch result indicates the job failed
    let failed = false;
    if (!sbatchResult.stdout) {
      failed = true;
    } else if (
      sbatchResult.stdout.includes("ERROR") ||
      sbatchResult.stdout.includes("WARN")
    ) {
      failed = true;
    } else if (!sbatchResult.stdout.includes("Submitted batch job ")) {
      failed = true;
    }

    // handle failed slurm jobs
    if (failed) {
      if (this.maintainer !== null)
        this.maintainer.emitEvent(
          "SLURM_SUBMIT_ERROR",
          "cannot submit job " +
          this.maintainer.id +
          ": " +
          JSON.stringify(sbatchResult)
        );

      throw new ConnectorError(
        "cannot submit job " +
        this.maintainer?.id +
        ": " +
        JSON.stringify(sbatchResult)
      );
    }

    // update slurm id in the job repo to reflect this slurm job run
    this.slurm_id = sbatchResult.stdout!.split(/[ ]+/).pop()!.trim();
    await this.maintainer?.updateJob({ slurmId: this.slurm_id });

    if (this.maintainer !== null)
      this.maintainer.emitEvent(
        "SLURM_SUBMIT_SUCCESS",
        `slurm job submitted with slurm job id ${this.slurm_id}`
      );
  }

  // example qstat stdout:
  // Job id              Name             Username        Time Use S Queue
  // ------------------- ---------------- --------------- -------- - ---------------
  // 3142249             singularity      cigi-gisolve    00:00:00 R node
  //
  // example squeue stdout: https://slurm.schedmd.com/squeue.html
  // ['JOBID', 'PARTITION', 'NAME', 'USER', 'ST', 'TIME', 'NODES', 'NODELIST(REASON)']
  // ['3142135', 'node', 'singular', 'cigi-gis', 'R', '0:11', '1', 'keeling-b08']

  /**
   *
   * checks job status
   * @returns job status (RETRY, UNKNOWN, or a slurm job status)
   */
  public async getStatus(): Promise<string> {
    try {
      // check the status of the current slurm job
      const squeueResult = await this.sshConnector.exec(
        `squeue --job ${this.slurm_id}`,
        {},
        true,
        true
      );

      // if squeue gave stdout without error, return the associated status of the current job (if any)
      // see above example to motivate this string processing code
      if (!squeueResult.stderr && squeueResult.stdout) {
        const r = squeueResult.stdout.split(/[ |\n]+/);
        const i = r.indexOf(this.slurm_id);
        return i >= 0 ? r[i + 4] : "UNKNOWN";
      }

      // if there was an error/didn't have stdout, try qstat
      const qstatResult = await this.sshConnector.exec(
        `qstat ${this.slurm_id}`,
        {},
        true,
        true
      );

      // if there was any stdout, return the status of the current job (if any)
      // see above example to motivate this string processing code
      if (qstatResult.stdout) {
        const r = qstatResult.stdout.split(/[ |\n]+/);
        const i = r.indexOf(this.slurm_id);
        return i >= 0 ? r[i + 4] : "UNKNOWN";
      }

      return "RETRY";
    } catch (_) {
      return "RETRY";
    }
  }

  /**
   * 
   * cancels the job
   */
  public async cancel() {
    await this.sshConnector.exec(`scancel ${this.slurm_id}`, {}, true);
  }

  /**
   * 
   * pauses the job
   */
  public async pause() {
    await this.sshConnector.exec(`scontrol suspend ${this.slurm_id}`, {}, true);
  }

  /**
   * 
   * resumes the job
   */
  public async resume() {
    await this.sshConnector.exec(`scontrol resume ${this.slurm_id}`, {}, true);
  }

  /**
   * 
   * gets SlurmStdOut and emit it as a log in the maintainer
   */
  public async getSlurmStdout() {
    const out = await this.sshConnector.cat(
      path.join(this.remoteResultFolderPath, "slurm_log", "job.stdout"),
      {}
    );

    if (this.maintainer && out) this.maintainer.emitLog(out);
  }

  /**
   * 
   * gets SlurmStderr and emit it as a log in the maintainer
   */
  public async getSlurmStderr() {
    const out = await this.sshConnector.cat(
      path.join(this.remoteResultFolderPath ?? "", "slurm_log", "job.stderr"),
      {}
    );

    if (this.maintainer && out) this.maintainer.emitLog(out);
  }

  /**
   * Get sbatch tags
   * @param tag sbatch tags
   * @param vals values of sbatch tags
   * @returns sbatch string
   */
  private getSBatchTagsFromArray(tag: string, vals: string[]): string {
    if (!vals) return "";

    let out = "";
    for (const val of vals) out += `#SBATCH --${tag}=${val}\n`;

    return out;
  }

  /**
   * gets remote executable folder path
   * @param [providedPath] specified path
   * @returns command execution output
   */
  public getRemoteExecutableFolderPath(providedPath: string | null = null): string {
    if (providedPath)
      return path.join(this.remoteExecutableFolderPath, providedPath);
    else
      return this.remoteExecutableFolderPath;
  }

  /**
   * gets remote data folder path
   * @param [providedPath] specified path
   * @returns command execution output
   */
  public getRemoteDataFolderPath(providedPath: string | null = null): string | null {
    if (providedPath)
      return path.join(this.remoteDataFolderPath, providedPath);
    else
      return this.remoteDataFolderPath;
  }

  /**
   * gets remote result folder path
   * @param [providedPath] specified path
   * @returns command execution output
   */
  public getRemoteResultFolderPath(providedPath: string | null = null): string {
    if (providedPath)
      return path.join(this.remoteResultFolderPath, providedPath);
    else
      return this.remoteResultFolderPath;
  }

  /**
   * Get Container executable folder path
   * @param [providedPath] specified path
   * @returns  executable path
   */
  public getContainerExecutableFolderPath(providedPath: string | null = null): string {
    if (providedPath) return path.join("/job/executable", providedPath);
    else return "/job/executable";
  }

  /**
   * Get Container CVMFS folder path
   * @param [providedPath] specified path
   * @returns executable path
   */
  public getContainerCVMFSFolderPath(providedPath: string | null = null): string {
    if (providedPath) return path.join("/tmp/cvmfs", providedPath);
    else return "/tmp/cvmfs";
  }

  /**
   * Get Container data folder path
   * @param [providedPath] specified path
   * @returns executable path
   */
  public getContainerDataFolderPath(providedPath: string | null = null): string {
    if (providedPath) return path.join("/job/data", providedPath);
    else return "/job/data";
  }

  /**
   * Get Container result folder path
   * @param [providedPath] specified path
   * @returns executable path
   */
  public getContainerResultFolderPath(providedPath: string | null = null): string {
    if (providedPath) return path.join("/job/result", providedPath);
    else return "/job/result";
  }

  /**
   *
   * Get remote results folder content
   * @returns file content
   */
  public async getRemoteResultFolderContent(): Promise<string[]> {
    const findResult = await this.sshConnector.exec(
      "find . -type d -print",  // find all directories in the cwd and print it out
      { cwd: this.getRemoteResultFolderPath() },  // set cwd to the result folder path
      true,
      true
    );

    if (config.is_testing && findResult.stderr)
      console.log(JSON.stringify(findResult)); // logging

    // no stdout -> return empty list
    if (!findResult.stdout) return [];

    // list of raw files found
    const rawFiles = findResult.stdout.split("\n");

    // turn list of raw files into a list of cleaned files
    const files = ["/"];
    for (const file of rawFiles) {
      let t = file.trim();
      if (t.startsWith(".")) t = t.replace("./", "");

      const rawFile = t.split("/");
      let skipFile = false;
      for (const inner_file of rawFile) {
        if (inner_file.startsWith(".")) {
          skipFile = true;
          break;
        } // ignore invisible files
      }

      if (skipFile) continue;

      const filePath = `/${rawFile.join("/")}`;
      if (!files.includes(filePath)) files.push(filePath);
    }

    return files;
  }

  /*    example usage query

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
   * @returns - usage dictionary
   */
  public async getUsage(): Promise<Record<string, number | null>> {
    const seffOutput: Record<string, number | null> = {
      nodes: null,
      cpus: null,
      cpuTime: null,
      memory: null,
      memoryUsage: null,
      walltime: null,
    };

    try {
      // get usage details
      const seffResult = await this.sshConnector.exec(`seff ${this.slurm_id}`, {}, true, true);
      if (seffResult.stderr) return seffOutput;

      if (!seffResult.stdout) {
        return seffOutput;
      }

      const tmp = seffResult.stdout.split("\n");

      // iterate over the lines in the usage output and do string processing
      // to motivate this string processing see the above output example
      for (const i of tmp) {
        const j = i.split(":");
        const k = j[0].trim();
        j.shift();
        let v = j.join(":").trim();

        switch (k) {
          case "Nodes":
            seffOutput.nodes = parseInt(v);
            break;
          case "Cores per node":
            seffOutput.cpus = parseInt(v);
            break;
          case "CPU Utilized": {
            const l = v.split(":");
            if (l.length !== 3) continue;
            const seconds =
              parseInt(l[0]) * 60 * 60 + parseInt(l[1]) * 60 + parseInt(l[2]);
            seffOutput.cpuTime = seconds;
            break;
          }
          case "Job Wall-clock time": {
            const l = v.split(":");
            if (l.length !== 3) continue;
            const seconds =
              parseInt(l[0]) * 60 * 60 + parseInt(l[1]) * 60 + parseInt(l[2]);
            seffOutput.walltime = seconds;
            break;
          }
          case "Memory Utilized": {
            v = v.toLowerCase();
            let kb = parseFloat(v.substring(0, v.length - 2).trim());
            const units = ["kb", "mb", "gb", "tb", "pb", "eb"];
            let isValid = false;
            for (const unit of units) {
              if (v.includes(unit)) {
                isValid = true;
                break;
              }
            }
            if (!isValid) continue;
            for (const unit of units) {
              if (v.includes(unit)) break;
              kb = kb * 1024;
            }
            seffOutput.memoryUsage = kb;
            break;
          }
          case "Memory Efficiency": {
            v = v.toLowerCase();
            let l = v.split("of");
            if (l.length !== 2) continue;
            l = l[1].trim().split("(");
            if (l.length !== 2) continue;
            v = l[0].trim();

            let kb = parseFloat(v.substring(0, v.length - 2).trim());
            const units = ["kb", "mb", "gb", "tb", "pb", "eb"];
            let isValid = false;
            for (const unit of units) {
              if (v.includes(unit)) {
                isValid = true;
                break;
              }
            }
            if (!isValid) continue;
            for (const unit of units) {
              if (v.includes(unit)) break;
              kb = kb * 1024;
            }
            seffOutput.memory = kb;
            break;
          }
          default:
            break;
        }
      }

      if (seffOutput.cpus && seffOutput.nodes) {
        seffOutput.cpus = seffOutput.cpus * seffOutput.nodes;
      } else {
        seffOutput.cpus = null;
      }
    } catch { }

    return seffOutput;
  }

  /**
   * @returns whether or not this connection is via a community account
   */
  public isCommunityAccount(): boolean {
    return this.sshConnector.isCommunityAccount;
  }

  /**
   *
   * @param path remote executable folder path
   */
  public setRemoteExecutableFolderPath(path: string) {
    this.remoteExecutableFolderPath = path;
  }

  /**
   *
   * @param path remote data folder path
   */
  public setRemoteDataFolderPath(path: string) {
    this.remoteDataFolderPath = path;
  }

  /**
   *
   * @param path remote result folder path
   */
  public setRemoteResultFolderPath(path: string) {
    this.remoteResultFolderPath = path;
  }

  /**
   * @returns the ssh connection this connector uses
   */
  public getSSHConnection(): SSHConnector {
    return this.sshConnector;
  }
}
