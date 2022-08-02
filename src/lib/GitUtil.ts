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
const rimraf = require("rimraf");

export default class GitUtil {
  static getLocalPath(gitId: string) {
    return path.join(config.local_file_system.root_path, gitId);
  }

  static async refreshGit(git: Git) {
    const localPath = this.getLocalPath(git.id);
    await FolderUtil.removeZip(localPath);

    // clone if git repo not exits locally
    if (!fs.existsSync(localPath)) {
      await fs.promises.mkdir(localPath);
      await exec(`cd ${localPath} && git clone ${git.address} ${localPath}`);
    }

    // update git repo before upload
    if (git.sha) {
      try {
        await exec(`cd ${localPath} && git checkout ${git.sha}`);
      } catch {
        rimraf.sync(localPath);
        await fs.promises.mkdir(localPath);
        await exec(`cd ${localPath} && git clone ${git.address} ${localPath}`);
        await exec(`cd ${localPath} && git checkout ${git.sha}`);
      }
    } else {
      await exec(`cd ${localPath} && git pull`);
    }
  }

  static async getExecutableManifest(git: Git) {
    const localPath = this.getLocalPath(git.id);
    const executableFolderPath = path.join(localPath, "manifest.json");
    const rawExecutableManifest = (
      await fs.promises.readFile(executableFolderPath)
    ).toString();

    const executableManifest: executableManifest = Object.assign(
      {
        name: undefined,
        container: undefined,
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

    for (var i in executableManifest.slurm_input_rules) {
      // remove invalid configs
      if (!slurm_configs.includes(i)) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      if (!executableManifest.slurm_input_rules[i].default_value) {
        delete executableManifest.slurm_input_rules[i];
        continue;
      }

      var j = executableManifest.slurm_input_rules[i];
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

    for (var i in executableManifest.param_rules) {
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
      if (executableManifest.param_rules[i].type == "integer") {
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

      if (executableManifest.param_rules[i].type == "string_option") {
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
