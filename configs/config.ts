import {
  config,
  hpcConfig,
  maintainerConfig,
  containerConfig,
  jupyterGlobusMapConfig,
} from "../src/types";

const rawConfig = require("../config.json");
const rawHpc = require("./hpc.json");
const rawMaintainer = require("./maintainer.json");
const rawContainerConfig = require("./container.json");
const rawJupyterGlobusMapConfig = require("./jupyter-globus-map.json");

const config: config = JSON.parse(JSON.stringify(rawConfig));

var hpcConfigMap: { [key: string]: hpcConfig } = {};
for (var i in rawHpc) {
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

var jupyterGlobusMap: { [key: string]: jupyterGlobusMapConfig } = {};
for (var i in rawJupyterGlobusMapConfig) {
  jupyterGlobusMap[i] = JSON.parse(
    JSON.stringify(rawJupyterGlobusMapConfig[i])
  );
}

var maintainerConfigMap: { [key: string]: maintainerConfig } = {};
for (var i in rawMaintainer) {
  maintainerConfigMap[i] = JSON.parse(JSON.stringify(rawMaintainer[i]));
}

var containerConfigMap: { [key: string]: containerConfig } = {};
for (var i in rawContainerConfig) {
  containerConfigMap[i] = JSON.parse(JSON.stringify(rawContainerConfig[i]));
}

export {
  config,
  hpcConfigMap,
  maintainerConfigMap,
  containerConfigMap,
  jupyterGlobusMap,
};
