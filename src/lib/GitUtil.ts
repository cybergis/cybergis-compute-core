import DB from "../DB";
import FolderUtil from "./FolderUtil";
import { Git } from "../models/Git";
import { exec } from "child-process-async";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../configs/config";
import {
  executableManifest,
  slurm_configs,
  slurm_integer_configs,
  slurm_integer_none_unit_config,
  slurm_integer_storage_unit_config,
  slurm_integer_time_unit_config,
  slurm_string_option_configs,
} from "../types";
import rimraf = require("rimraf");

/**
 * 
 */
export default class GitUtil {


  /**
   * Gets the local path of a given git repository. 
   *
   * @static
   * @param {string} gitId
   * @return {string} resulting path 
   */
  static getLocalPath(gitId: string): string {
    return path.join(config.local_file_system.root_path, gitId);
  }

  /**
   * Deletes a specified git repository and pulls it again.
   *
   * @static
   * @param {Git} git
   */
  static async deleteAndPull(git: Git) {
    const localPath = this.getLocalPath(git.id);
    rimraf.sync(localPath);  // deletes everything

    await fs.promises.mkdir(localPath);
    await exec(`cd ${localPath} && git clone ${git.address} ${localPath}`);

    if (git.sha) {
      // if a sha is specified, checkout that commit
      await exec(`cd ${localPath} && git checkout ${git.sha}`);
    }
  }
  
  /**
   * Repulls a git repository if it is out of date and records it in git database.
   *
   * @static
   * @param {Git} git git object
   */
  static async refreshGit(git: Git) {
    const localPath = this.getLocalPath(git.id);
    await FolderUtil.removeZip(localPath);
    
    // clone if git repo not exits locally
    if (!fs.existsSync(localPath)) {
      await fs.promises.mkdir(localPath);
      await exec(`cd ${localPath} && git clone ${git.address} ${localPath}`);
    }

    //check when last updated
    let now = new Date();
    // set to a large number so that we update if the check fails
    let secsSinceUpdate = 1000000;
    try {
      // check when last updated if you can. If updatedAt is null this throws error
      secsSinceUpdate = (now.getTime() - git.updatedAt.getTime()) / 1000.0;
    } catch {}
    if (secsSinceUpdate > 120) {
      console.log(`${git.id} is stale, let's update...`);
      // update git repo before upload
      try {
        // try checking out the sha or pulling latest
        if (git.sha) {
          await exec(`cd ${localPath} && git checkout ${git.sha}`);
        } else {
          await exec(`cd ${localPath} && git pull`);
        }
      } catch {
        // if there is an error, delete and repull
        await this.deleteAndPull(git);
      }
      // call to update the updatedAt timestamp
      now = new Date();
      const db = new DB(false);
      const connection = await db.connect();
      await connection
        .createQueryBuilder()
        .update(Git)
        .where("id = :id", { id: git.id })
        .set({"updatedAt" : now})
        .execute();
    }
    else {
      console.log(`${git.id} last updated ${secsSinceUpdate}s ago, skipping update`);
    }
  }

  /**
   * Does some logic on and returns the manifest json of the executable of a git object. 
   *
   * @static
   * @param {Git} git git object to get the manifest 
   * @return {executableManifest} the cleaned manifest 
   */
  static async getExecutableManifest(git: Git): Promise<executableManifest> {
    const localPath = this.getLocalPath(git.id);
    const executableFolderPath = path.join(localPath, "manifest.json");

    let rawExecutableManifest;
    try {
      rawExecutableManifest = (
        await fs.promises.readFile(executableFolderPath)
      ).toString();
    } catch (e) {
      // delete, repull, and then read
      console.log(`Encountered error with manifest: ${e}.\nDeleting and repulling`);
      await this.deleteAndPull(git);
      rawExecutableManifest = (
        await fs.promises.readFile(executableFolderPath)
      ).toString();
    }

    const executableManifest: executableManifest = Object.assign(
      {
        name: undefined,
        container: undefined,
        connector: undefined,
        pre_processing_stage: undefined,
        execution_stage: undefined,
        post_processing_stage: undefined,
        description: "none",
        estimated_runtime: "unknown",
        supported_hpc: ["keeling_community"],
        default_hpc: undefined,
        repository: git.address,
        require_upload_data: false,
        slurm_input_rules: {},
        param_rules: {},
      },
      JSON.parse(rawExecutableManifest)
    );

    if (!executableManifest.default_hpc) {
      executableManifest.default_hpc = executableManifest.supported_hpc[0];
    }

    for (const i in executableManifest.slurm_input_rules) {
      // remove invalid configs
      if (!slurm_configs.includes(i)) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      if (!executableManifest.slurm_input_rules[i].default_value) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      const j = executableManifest.slurm_input_rules[i];
      if (
        slurm_integer_time_unit_config.includes(i) &&
        !["Minutes", "Hours", "Days"].includes(j.unit)
      ) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      if (
        slurm_integer_storage_unit_config.includes(i) &&
        !["GB", "MB"].includes(j.unit)
      ) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      // default values
      if (slurm_integer_none_unit_config.includes(i)) {
        executableManifest.slurm_input_rules[i].unit = "None";
        continue;
      }

      if (slurm_integer_configs.includes(i)) {
        if (!executableManifest.slurm_input_rules[i].max) {
          executableManifest.slurm_input_rules[i].max =
            executableManifest.slurm_input_rules[i].default_value * 2;
        }
        if (!executableManifest.slurm_input_rules[i].min) {
          executableManifest.slurm_input_rules[i].min = 0;
        }
        if (!executableManifest.slurm_input_rules[i].step) {
          executableManifest.slurm_input_rules[i].step = 1;
        }
      }

      if (slurm_string_option_configs.includes(i)) {
        if (!executableManifest.slurm_input_rules[i].options) {
          executableManifest.slurm_input_rules[i].options = [
            executableManifest.slurm_input_rules[i].default_value,
          ];
        }
        if (
          !executableManifest.slurm_input_rules[i].options.includes(
            executableManifest.slurm_input_rules[i].default_value
          )
        ) {
          executableManifest.slurm_input_rules[i].options.push(
            executableManifest.slurm_input_rules[i].default_value
          );
        }
      }
    }

    for (const i in executableManifest.param_rules) {
      // ignore invalid param
      if (!executableManifest.param_rules[i].default_value) {
        delete executableManifest.param_rules[i];
        continue;
      }

      if (
        !["integer", "string_option", "string_input"].includes(
          executableManifest.param_rules[i].type
        )
      ) {
        delete executableManifest.param_rules[i];
        continue;
      }

      // default values
      if (executableManifest.param_rules[i].type === "integer") {
        if (!executableManifest.param_rules[i].max) {
          executableManifest.param_rules[i].max =
            executableManifest.param_rules[i].default_value * 2;
        }
        if (!executableManifest.param_rules[i].min) {
          executableManifest.param_rules[i].min = 0;
        }
        if (!executableManifest.param_rules[i].step) {
          executableManifest.param_rules[i].step = 1;
        }
      }

      if (executableManifest.param_rules[i].type === "string_option") {
        if (!executableManifest.param_rules[i].options) {
          executableManifest.param_rules[i].options = [
            executableManifest.param_rules[i].default_value,
          ];
        }
        if (
          !executableManifest.param_rules[i].options.includes(
            executableManifest.param_rules[i].default_value
          )
        ) {
          executableManifest.param_rules[i].options.push(
            executableManifest.param_rules[i].default_value
          );
        }
      }
    }

    return executableManifest;
  }
}
