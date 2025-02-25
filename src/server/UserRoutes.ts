import express = require("express");


import * as path from "path";

import {
  jupyterGlobusMap
} from "../../configs/config";
import { GlobusClient } from "../helpers/GlobusTransferUtil";
import * as Helper from "../helpers/Helper";
import JobUtil from "../helpers/JobUtil";
import { Job } from "../models/Job";
import dataSource from "../utils/DB";

import { authMiddleWare } from "./ServerUtil";

const userRouter = express.Router();

/**
 * @openapi
 * /user:
 *  get:
 *      description: Returns the current user"s username (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns the current user"s username
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns an error if the user"s username is not in the allowlist
 */
userRouter.get("/", authMiddleWare, (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }
  
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  res.json({ username: res.locals.username as string });
});
  
/**
   * @openapi
   * /user/jupyter-globus:
   *  get:
   *      description: Returns jupyter-globus information incuding the endpoint, root path, and container home path (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns the jupyter-globus endpoint, root path and container home path as a single dictionary
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          403:
   *              description: Returns an error if the current user does not map to a jupyter-globus user
   *          404:
   *              description: Returns an error if the user"s username is not in the allowlist
   */
userRouter.get("/jupyter-globus", authMiddleWare, (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }
  
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // extract username minus the last segment after an @
  const username_array: string[] = (res.locals.username as string).split("@");
  let username = username_array.slice(0, username_array.length - 1).join("@");
  const jupyterGlobus = jupyterGlobusMap[res.locals.host as string];
  
  try {
    // get a processed username (mapping changes depending on the host)
    username = GlobusClient.mapUsername(
      username,
      jupyterGlobus.user_mapping ?? null
    );
  } catch (err) {
    res
      .status(403)
      .json({
        error: `Failed to map jupyter-globus: ${
          Helper.assertError(err).toString()
        }`
      });
    return;
  }
  
  res.json({
    endpoint: jupyterGlobus.endpoint,
    root_path: path.join(jupyterGlobus.root_path, username),
    container_home_path: jupyterGlobus.container_home_path,
  });
});
  
/**
   * @openapi
   * /user/job:
   *  get:
   *      description: Returns a list of all of the current user"s jobs (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns all of the jobs for the current user in a list of dictionary objects representing each job
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          404:
   *              description: Returns an error if the user"s username is not in the allowlist
   */
userRouter.get("/job", authMiddleWare, async (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }
  
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // get all jobs associated with user
  const jobs = await dataSource.getRepository(Job).find({
    where: { userId: res.locals.username as string },
    relations: [
      "remoteDataFolder",
      "remoteResultFolder",
      "remoteExecutableFolder",
    ],
  });
  
  res.json({ job: Helper.job2object(jobs) });
});
  
/**
   * @openapi
   * /user/slurm-usage:
   *  get:
   *      description: Returns dictionary object of slurm usage for the current user (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns dictionary object of slurm usage for the current user
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   */
userRouter.get("/slurm-usage", authMiddleWare, async (req, res) => {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // get all jobs associated with user, then aggregate, then return that
  res.json(
    await JobUtil.getUserSlurmUsage(res.locals.username as string, true)
  );
});

export default userRouter;