import express = require("express");

import * as fs from "fs";

import { hpcConfigMap, maintainerConfigMap, containerConfigMap, jupyterGlobusMap } from "../../configs/config";
import * as Helper from "../helpers/Helper";
import { Job } from "../models/Job";
import dataSource from "../utils/DB";
import { hpcConfig, maintainerConfig, containerConfig, jupyterGlobusMapConfig, announcementsConfig } from "../utils/types";

import { authMiddleWare, statistic } from "./ServerUtil";

const infoRouter = express.Router();

/**
 * @openapi
 * /statistic:
 *  get:
 *      description: Get the runtime of null across available HPC clusters (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              descrption: Returns JSON containing runtime in seconds total and per cluster (null here becauise no job referenced)
 *
 */
infoRouter.get("/statistic", async (req, res) => {
  res.json({ runtime_in_seconds: await statistic.getRuntimeTotal() });
});
  
/**
   * @openapi
   * /statistic/job/:jobId:
   *  get:
   *      description: Get the runtime for a specific job across available HPC clusters (Authentication REQUIRED)
   *      responses:
   *          200:
   *              descrption: Returns JSON containing runtime in seconds total and per cluster
   *          401:
   *              description: Returns a list of errors rasied when validating the job access token.
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token is not provided
   *
   */
infoRouter.get("/statistic/job/:jobId", authMiddleWare, async (req, res) => {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  try {
    // query the job matching the params
    const job = await dataSource
      .getRepository(Job)
      .findOneBy({ id: req.params.jobId, userId: res.locals.username as string });
  
    if (job === null) {
      throw new Error("job not found.");
    }
  
    res.json({ runtime_in_seconds: await statistic.getRuntimeByJobId(job.id) });
  } catch (e) {
    res.status(401).json(
      { error: "invalid access", messages: [Helper.assertError(e).toString()] }
    );
  }
});
  
/**
   * @openapi
   * /hpc:
   *  get:
   *      description: Returns current hpc configurations for existing linked hpc clusters as a dictionary (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns current hpc configurations for existing linked hpc clusters as a dictionaruy
   */
infoRouter.get("/hpc", function (req, res) {
  const parseHPC = (dest: Record<string, hpcConfig>) => {
    // create truncated version of all hpc configs
    const out: Record<string, Partial<hpcConfig>> = {};
    for (const i in dest) {
      const d: Partial<hpcConfig> = JSON.parse(
        JSON.stringify(dest[i])
      ) as hpcConfig; // hard copy
  
      delete d.init_sbatch_script;
      delete d.init_sbatch_options;
      delete d.community_login;
      delete d.root_path;
      out[i] = d;
    }
    return out;
  };
  
  res.json({ hpc: parseHPC(hpcConfigMap) });
});
  
/**
   * @openapi
   * /maintainer:
   *  get:
   *      description: Returns current maintainer configurations as a dictionary object (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns current maintainer configurations as a dictionary object
   */
infoRouter.get("/maintainer", function (req, res) {
  const parseMaintainer = (dest: Record<string, maintainerConfig>) => {
    const out: Record<string, maintainerConfig> = {};
    for (const i in dest) {
      const d: maintainerConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as maintainerConfig; // hard copy
  
      out[i] = d;
    }
    return out;
  };
  
  res.json({ maintainer: parseMaintainer(maintainerConfigMap) });
});
  
/**
   * @openapi
   * /container:
   *  get:
   *      description: Returns current container configurations as a dictionary object (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns current container configurations as a dictionary object
   */
infoRouter.get("/container", function (req, res) {
  const parseContainer = (dest: Record<string, containerConfig>) => {
    const out: Record<string, containerConfig> = {};
    for (const i in dest) {
      const d: containerConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as containerConfig; // hard copy
  
      if (!(i in ["dockerfile", "dockerhub"])) out[i] = d;  // exclude dockerfiles/dockerhub configs
    }
    return out;
  };
  
  res.json({ container: parseContainer(containerConfigMap) });
});
  
/**
   * @openapi
   * /whitelist:
   *  get:
   *      description: (Use /allowlist instead. /whitelist is being phased out.) Returns current allowlist (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns current allowlist
   */
infoRouter.get("/whitelist", function (req, res) {
  const parseHost = (dest: Record<string, jupyterGlobusMapConfig>) => {
    const out: Record<string, string> = {};
    for (const i in dest) {
      const d = JSON.parse(JSON.stringify(dest[i])) as jupyterGlobusMapConfig; // hard copy
      out[i] = d.comment;
    }
    return out;
  };
  
  res.json({ whitelist: parseHost(jupyterGlobusMap) });
});
  
/**
   * @openapi
   * /allowlist:
   *  get:
   *      description: Returns current allowlist (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns current allowlist
   */
infoRouter.get("/allowlist", function (req, res) {
  const parseHost = (dest: Record<string, jupyterGlobusMapConfig>) => {
    const out: Record<string, string> = {};
    for (const i in dest) {
      const d: jupyterGlobusMapConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as jupyterGlobusMapConfig; // hard copy
  
      out[i] = d.comment;
    }
    return out;
  };
  
  res.json({ allowlist: parseHost(jupyterGlobusMap) });
});
  
/**
   * @openapi
   * /announcement:
   *  get:
   *      description: Returns list of current announcements (Authentication NOT REQUIRED)
   *      responses:
   *          200:
   *              description: Returns array of current announcements
   */
infoRouter.get("/announcement", function (req, res) {
  // read announcements from the announcements.json file
  fs.readFile("./configs/announcement.json", "utf8", function (err, data) {
    const parseHost = (dest: Record<string, announcementsConfig>) => {
      const out: Record<string, announcementsConfig> = {};
      for (const i in dest) {
        const d: announcementsConfig = JSON.parse(
          JSON.stringify(dest[i])
        ) as announcementsConfig; // hard copy
  
        out[i] = d;
      }
      return out;
    };
  
    res.json(
      parseHost(JSON.parse(data) as Record<string, announcementsConfig>)
    );
  });
});

export default infoRouter;