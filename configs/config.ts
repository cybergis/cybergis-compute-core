import { rootPath } from "get-root-path";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  baseConfig,
  hpcConfig,
  maintainerConfig,
  containerConfig,
  jupyterGlobusMapConfig,
  kernelConfig,
} from "../src/definitions";

async function createConfigMap<T>(
  configPath: string,
  defaultValues: Partial<T> = {}
): Promise<Record<string, T>> {
  const file = await readFile(path.join(rootPath, "configs", configPath), "utf8");
  const rawConfig = JSON.parse(file) as Record<string, unknown>;
  
  const configMap: Record<string, T> = {};
  
  for (const key in rawConfig) {
    configMap[key] = Object.assign(
      {},
      defaultValues,
      rawConfig[key]
    ) as T;
  }
  
  return configMap;
}

const file = await readFile(path.join(rootPath, "config.json"), "utf8");
const config = JSON.parse(file) as baseConfig;


// create and populate configs
const hpcDefaults: Partial<hpcConfig> = {
  ip: undefined,
  port: undefined,
  is_community_account: undefined,
  community_login: undefined,
  root_path: undefined,
  job_pool_capacity: undefined,
  init_sbatch_script: [],
  init_sbatch_options: [],
  description: "none",
  globus: undefined,
  mount: {},
  slurm_input_rules: {},
  allocation: undefined,
  partition: undefined
};

const hpcConfigMap= await createConfigMap("hpc.json", hpcDefaults);
const jupyterGlobusMap: Record<string, jupyterGlobusMapConfig> = await createConfigMap("jupyter-globus-map.json");
const maintainerConfigMap: Record<string, maintainerConfig> = await createConfigMap("maintainer.json");
const containerConfigMap: Record<string, containerConfig> = await createConfigMap("container.json");
const kernelConfigMap: Record<string, kernelConfig> = await createConfigMap("kernel.json");

export {
  config,
  hpcConfigMap,
  maintainerConfigMap,
  containerConfigMap,
  jupyterGlobusMap,
  kernelConfigMap,
};
