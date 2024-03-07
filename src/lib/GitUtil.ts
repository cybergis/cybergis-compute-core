import rimraf from "rimraf";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { config } from "../../configs/config";
import DB from "../DB";
import { Git } from "../models/Git";
import {
  executableManifest,
  integerRule,
  slurm_configs,
  slurm_integer_configs,
  slurm_integer_none_unit_config,
  slurm_integer_storage_unit_config,
  slurm_integer_time_unit_config,
  slurm_string_option_configs,
  stringOptionRule,
} from "../types";
import FolderUtil from "./FolderUtil";

const exec: Function = promisify(require("child_process").exec); // eslint-disable-line

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
   * Gets the local manifest path of a given git repository. 
   *
   * @static
   * @param {string} gitId
   * @return {string} resulting path 
   */
  static getLocalManifestPath(gitId: string): string {
    return path.join(config.local_file_system.root_path, "manifests", gitId);
  }

  /**
   * Deletes a specified git repository and pulls it again.
   *
   * @static
   * @param {Git} git
   */
  static async deleteAndPull(git: Git) {
    const localPath = this.getLocalPath(git.id);
    // eslint-disable-next-line
    rimraf.sync(localPath);  // deletes everything

    await fs.promises.mkdir(localPath);
    await exec(`cd ${localPath} && git clone ${git.address} ${localPath}`);

    if (git.sha) {
      // if a sha is specified, checkout that commit
      await exec(`cd ${localPath} && git checkout ${git.sha}`);
    }
  }

  /**
   * Deletes a specified manifest of a git repository and pulls it again.
   *
   * @static
   * @param {Git} git
   */
  static async deleteAndPullManifest(git: Git) {
    const localPath = this.getLocalManifestPath(git.id);
    // eslint-disable-next-line
    rimraf.sync(localPath);  // deletes everything

    const getManifestUrl = (
      (commit: string) => 
        `git.address.replace("github.com", "raw.githubusercontent.com").replace(".git", "")}/${commit}/manifest.json`
    );

    await fs.promises.mkdir(localPath, { recursive: true });
    
    if (git.sha) {
      // if a sha is specified, checkout that commit
      await exec(`cd ${localPath} && wget -O manifest.json ${getManifestUrl(git.sha)}`);
    } else {
      await exec(`cd ${localPath} && wget -O manifest.json ${getManifestUrl("main")}`);
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
   * Repulls only the repository of a git repo if it is out of date and records it in git database.
   *
   * @static
   * @param {Git} git
   */
  static async refreshGitManifest(git: Git) {
    const localPath = this.getLocalManifestPath(git.id);
    const getManifestUrl = (
      (commit: string) => 
        `${git.address.replace("github.com", "raw.githubusercontent.com").replace(".git", "")}/${commit}/manifest.json`
    );
    
    // get the manifest if it does not exist locally
    if (!fs.existsSync(localPath)) {
      await fs.promises.mkdir(localPath, { recursive: true });
      // TODO: either get the branch/the sha of the thing we want
      await exec(`cd ${localPath} && wget -O manifest.json ${getManifestUrl("main")}`);
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
          await exec(`cd ${localPath} && wget -O manifest.json ${getManifestUrl(git.sha)}`);
        } else {
          await exec(`cd ${localPath} && wget -O manifest.json ${getManifestUrl("main")}`);
        }
      } catch {
        // if there is an error, delete and repull
        await this.deleteAndPullManifest(git);
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
   * Uses the normal git path (with git pulls and checkouts).
   *
   * @static
   * @param {Git} git git object to get the manifest 
   * @return {executableManifest} the cleaned manifest 
   */
  static async getExecutableManifest(git: Git): Promise<executableManifest> {
    const localPath = this.getLocalPath(git.id);
    const executableFolderPath = path.join(localPath, "manifest.json");

    let rawExecutableManifest: string;
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

    return this.processExecutableManifest(rawExecutableManifest, git.address);
  }

  /**
   * Processes a raw string manifest and returns it as a cleaned executableManifest.
   *
   * @static
   * @param {string} rawExecutableManifest string form of manifest
   * @param {string} address git address
   * @return {executableManifest} cleaned manifest
   */
  static processExecutableManifest(
    rawExecutableManifest: string,
    address: string
  ) : executableManifest {
    const executableManifest = Object.assign(
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
        repository: address,
        require_upload_data: false,
        slurm_input_rules: {},
        param_rules: {},
      },
      JSON.parse(rawExecutableManifest)
    ) as executableManifest;

    if (!executableManifest.default_hpc && executableManifest.supported_hpc) {
      executableManifest.default_hpc = executableManifest.supported_hpc[0];
    }

    for (const rule_name in executableManifest.slurm_input_rules) {
      
      // remove invalid configs
      if (!slurm_configs.includes(rule_name)) {
        delete executableManifest.slurm_input_rules[rule_name];
        continue;
      }

      // pass by reference
      const rule = (executableManifest
        .slurm_input_rules[rule_name] 
      ) as integerRule | stringOptionRule;

      if (!rule.default_value) {
        delete executableManifest.slurm_input_rules[rule_name];
        continue;
      }

      if (
        slurm_integer_time_unit_config.includes(rule_name) &&
        (rule as integerRule).unit !== undefined &&
        !["Minutes", "Hours", "Days"].includes((rule as integerRule).unit!)
      ) {
        delete executableManifest.slurm_input_rules[rule_name];
        continue;
      }

      if (
        slurm_integer_storage_unit_config.includes(rule_name) &&
        (rule as integerRule).unit !== undefined &&
        !["GB", "MB"].includes((rule as integerRule).unit!)
      ) {
        delete executableManifest.slurm_input_rules[rule_name];
        continue;
      }

      // default values
      if (slurm_integer_none_unit_config.includes(rule_name)) {
        (rule as integerRule).unit = "None";
        continue;
      }

      if (slurm_integer_configs.includes(rule_name)) {
        if (!(rule as integerRule).max) {
          (rule as integerRule).max = (rule as integerRule).default_value * 2;
        }
        if (!(rule as integerRule).min) {
          (rule as integerRule).min = 0;
        }
        if (!(rule as integerRule).step) {
          (rule as integerRule).step = 1;
        }
      }

      if (slurm_string_option_configs.includes(rule_name)) {
        if (!(rule as stringOptionRule).options) {
          (rule as stringOptionRule).options = [
            (rule as stringOptionRule).default_value,
          ];
        }
        if (
          !(rule as stringOptionRule).options.includes(
            (rule as stringOptionRule).default_value
          )
        ) {
          (rule as stringOptionRule).options.push(
            (rule as stringOptionRule).default_value
          );
        }
      }
    }

    for (const rule_name in executableManifest.param_rules) {
      // ignore invalid param
      if (!executableManifest.param_rules[rule_name].default_value) {
        delete executableManifest.param_rules[rule_name];
        continue;
      }

      if (
        !["integer", "string_option", "string_input"].includes(
          executableManifest.param_rules[rule_name].type === undefined ? "" : executableManifest.param_rules[rule_name].type as string
        )
      ) {
        delete executableManifest.param_rules[rule_name];
        continue;
      }

      // default values
      if (executableManifest.param_rules[rule_name].type === "integer") {
        const rule: integerRule = (executableManifest
          .param_rules[rule_name]
        ) as integerRule;

        if (!rule.max) {
          rule.max = rule.default_value * 2;
        }

        if (!rule.min) {
          rule.min = 0;
        }

        if (!rule.step) {
          rule.step = 1;
        }
      }

      if (executableManifest.param_rules[rule_name].type === "string_option") {
        const rule: stringOptionRule = (executableManifest
          .param_rules[rule_name]
        ) as stringOptionRule;

        if (!rule.options) {
          rule.options = [rule.default_value,];
        }

        if (!rule.options.includes(rule.default_value)) {
          rule.options.push(rule.default_value);
        }
      }
    }

    return executableManifest;
  }

  /**
   * Does some logic on and returns the manifest json of the executable of a git object. 
   * Uses the manifests/ path to do so. 
   *
   * @static
   * @param {Git} git git object to get the manifest 
   * @return {executableManifest} the cleaned manifest 
   */
  static async getExecutableManifestSpecialized(
    git: Git
  ): Promise<executableManifest> {
    const localPath = this.getLocalManifestPath(git.id);
    const executableFolderPath = path.join(localPath, "manifest.json");

    let rawExecutableManifest: string;
    try {
      rawExecutableManifest = (
        await fs.promises.readFile(executableFolderPath)
      ).toString();
    } catch (e) {
      // delete, repull, and then read
      console.log(`Encountered error with manifest: ${e}.\nDeleting and repulling`);
      await this.deleteAndPullManifest(git);
      rawExecutableManifest = (
        await fs.promises.readFile(executableFolderPath)
      ).toString();
    }

    return this.processExecutableManifest(rawExecutableManifest, git.address);
  }
}
