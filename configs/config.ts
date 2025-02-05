import {
  baseConfig,
  hpcConfig,
  maintainerConfig,
  containerConfig,
  jupyterGlobusMapConfig,
  kernelConfig,
} from "../src/definitions";
// eslint-disable-next-line import/order
import rawConfig from "../config.json"; // base config
import rawContainerConfig from "./container.json";  // docker container config
import rawHpc from "./hpc.json";  // hpc configuration
import rawJupyterGlobusMapConfig from "./jupyter-globus-map.json";  // globus configs
import rawKernelConfig from "./kernel.json";  // python kernel configs
import rawMaintainer from "./maintainer.json";  // maintainer config

type ConfigMap = Record<string, unknown>;

function createConfigMap<T>(
  rawConfig: ConfigMap,
  defaultValues: Partial<T> = {}
): Record<string, T> {
  const configMap: Record<string, T> = {};
  
  for (const key in rawConfig) {
    configMap[key] = Object.assign(
      {},
      defaultValues,
      JSON.parse(JSON.stringify(rawConfig[key]))
    ) as T;
  }
  
  return configMap;
}

const config: baseConfig = JSON.parse(JSON.stringify(rawConfig)) as baseConfig;

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

const hpcConfigMap: Record<string, hpcConfig> = createConfigMap(rawHpc as ConfigMap, hpcDefaults);

const jupyterGlobusMap: Record<string, jupyterGlobusMapConfig> = 
  createConfigMap(rawJupyterGlobusMapConfig as ConfigMap);

const maintainerConfigMap: Record<string, maintainerConfig> = 
  createConfigMap(rawMaintainer as ConfigMap);

const containerConfigMap: Record<string, containerConfig> = 
  createConfigMap(rawContainerConfig as ConfigMap);
  
const kernelConfigMap: Record<string, kernelConfig> = createConfigMap(rawKernelConfig as ConfigMap);

export {
  config,
  hpcConfigMap,
  maintainerConfigMap,
  containerConfigMap,
  jupyterGlobusMap,
  kernelConfigMap,
};
