import {
  config,
  hpcConfig,
  maintainerConfig,
  containerConfig,
  jupyterGlobusMapConfig,
  kernelConfig,
} from "../src/types";
// eslint-disable-next-line import/order
import rawConfig from "../config.json"; // base config
import rawContainerConfig from "./container.json";  // docker container config
import rawHpc from "./hpc.json";  // hpc configuration
import rawJupyterGlobusMapConfig from "./jupyter-globus-map.json";  // globus configs
import rawKernelConfig from "./kernel.json";  // python kernel configs
import rawMaintainer from "./maintainer.json";  // maintainer config

const config: config = JSON.parse(JSON.stringify(rawConfig)) as config;

// create and populate configs

const hpcConfigMap: Record<string, hpcConfig> = {};
for (const hpc in rawHpc) {
  hpcConfigMap[hpc] = Object.assign(
    {
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
    },
    JSON.parse(JSON.stringify((rawHpc as Record<string, unknown>)[hpc]))
  ) as hpcConfig;
}

const jupyterGlobusMap: Record<string, jupyterGlobusMapConfig> = {};
for (const globusMap in rawJupyterGlobusMapConfig) {
  jupyterGlobusMap[globusMap] = JSON.parse(
    JSON.stringify(
      (rawJupyterGlobusMapConfig as Record<string, unknown>)[globusMap]
    )
  ) as jupyterGlobusMapConfig;
}

const maintainerConfigMap: Record<string, maintainerConfig> = {};
for (const maintainer in rawMaintainer) {
  maintainerConfigMap[maintainer] = JSON.parse(
    JSON.stringify((rawMaintainer as Record<string, unknown>)[maintainer])
  ) as maintainerConfig;
}

const containerConfigMap: Record<string, containerConfig> = {};
for (const container in rawContainerConfig) {
  containerConfigMap[container] = JSON.parse(
    JSON.stringify((rawContainerConfig as Record<string, unknown>)[container])
  ) as containerConfig;
}

const kernelConfigMap: Record<string, kernelConfig> = {};
for (const i in rawKernelConfig) {
  kernelConfigMap[i] = JSON.parse(
    JSON.stringify((rawKernelConfig as Record<string, unknown>)[i])
  ) as kernelConfig;
}

export {
  config,
  hpcConfigMap,
  maintainerConfigMap,
  containerConfigMap,
  jupyterGlobusMap,
  kernelConfigMap,
};
