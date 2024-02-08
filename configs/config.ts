import {
  config,
  hpcConfig,
  maintainerConfig,
  containerConfig,
  jupyterGlobusMapConfig,
  kernelConfig,
} from "../src/types";

import rawConfig = require("../config.json"); // base config
import rawHpc = require("./hpc.json"); // hpc configuration
import rawMaintainer = require("./maintainer.json"); // maintainer config
import rawContainerConfig = require("./container.json"); // docker container config
import rawJupyterGlobusMapConfig = require("./jupyter-globus-map.json"); // globus configs
import rawKernelConfig = require("./kernel.json"); // python kernel configs

const config: config = JSON.parse(JSON.stringify(rawConfig));

// create and populate configs

const hpcConfigMap: { [key: string]: hpcConfig } = {};
for (const i in rawHpc) {
  hpcConfigMap[i] = Object.assign(
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
    JSON.parse(JSON.stringify(rawHpc[i]))
  );
}

const jupyterGlobusMap: { [key: string]: jupyterGlobusMapConfig } = {};
for (const i in rawJupyterGlobusMapConfig) {
  jupyterGlobusMap[i] = JSON.parse(
    JSON.stringify(rawJupyterGlobusMapConfig[i])
  );
}

const maintainerConfigMap: { [key: string]: maintainerConfig } = {};
for (const i in rawMaintainer) {
  maintainerConfigMap[i] = JSON.parse(JSON.stringify(rawMaintainer[i]));
}

const containerConfigMap: { [key: string]: containerConfig } = {};
for (const i in rawContainerConfig) {
  containerConfigMap[i] = JSON.parse(JSON.stringify(rawContainerConfig[i]));
}

const kernelConfigMap: { [key: string]: kernelConfig } = {};
for (const i in rawKernelConfig) {
  kernelConfigMap[i] = JSON.parse(JSON.stringify(rawKernelConfig[i]));
}

export {
  config,
  hpcConfigMap,
  maintainerConfigMap,
  containerConfigMap,
  jupyterGlobusMap,
  kernelConfigMap,
};
