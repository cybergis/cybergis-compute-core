import express = require("express");


import * as path from "path";

import {
  hpcConfigMap,
} from "../../configs/config";
import { GlobusClient } from "../helpers/GlobusTransferUtil";
import * as Helper from "../helpers/Helper";
import { Folder } from "../models/Folder";
import dataSource from "../utils/DB";
import type {
  updateFolderBody,
  initGlobusDownloadBody,
  GlobusFolder
} from "../utils/types";

import { authMiddleWare, requestErrors, validator, schemas, prepareDataForDB, globusTaskList } from "./ServerUtil";

const folderRouter = express.Router();

/**
 * @openapi
 * /folder:
 *  get:
 *      description: Returns list of folders stored as dictionary objects (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns list of folders as dictionary objects with metadata
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 */
folderRouter.get("/", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // get all folders associated with the user from the database
  const folder = await dataSource
    .getRepository(Folder)
    .findBy({ userId: res.locals.username as string });
  res.json({ folder: folder });
});
  
/**
   * @openapi
   * /folder/:folderId:
   *  get:
   *      description: Returns a specific folder stored as a dictionary object (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns a folder as a dictionary object with metadata
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   */
folderRouter.get("/:folderId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // get all folders associated with the user and with the given folder Id from the database
  const folder = await dataSource
    .getRepository(Folder)
    .findBy({ userId: res.locals.username as string, id: req.params.folderId });
  res.json(folder);
});
  
/**
   * @openapi
   * /folder/:folderId:
   *  delete:
   *      description: Deletes an ID specified folder (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Deletes the folder specified by the ID
   *          401:
   *              description: Returns "encountered error" when the folder deletion throws an exception
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          404:
   *              description: Returns "unknown folder with id" when the specified folder is not found
   */
folderRouter.delete("/:folderId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // try to find the folder with the given id/associated user; if not found, give a 404
  const folderId = req.params.folderId;
  const folder = await dataSource
    .getRepository(Folder)
    .findOneBy({ userId: res.locals.username as string, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }
  
  try {
    await dataSource.getRepository(Folder).softDelete(folderId);  // not actually deleted, just marked as such
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(401).json(
      { error: "encountered error: " + Helper.assertError(err).toString() }
    );
  
    return;
  }
});
  
/**
   * @openapi
   * /folder/:folderId:
   *  put:
   *      description: Updates a folder with the given ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Updates the folder specified by the ID and returns folder
   *          401:
   *              description: Returns "encountered error" when updating the folder throws an exception
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          404:
   *              description: Returns "unknown folder with id" when the specified folder is not found
   */
folderRouter.put("/:folderId", authMiddleWare, async function (req, res) {
  const errors = requestErrors(
    validator.validate(req.body, schemas.updateFolder)
  );
  
  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  
  const body = req.body as updateFolderBody;
  
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  // try to find the folder specified in the body, if not found, give a 404
  const folderId = req.params.folderId;
  const folder = await dataSource
    .getRepository(Folder)
    .findOneBy({ userId: res.locals.username as string, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }
  
  // body parameters to pass as folder properties
  if (body.name) folder.name = body.name;
  if (body.isWritable) folder.isWritable = body.isWritable;
  
  try {
    // update the folder entry and return it
    await dataSource
      .createQueryBuilder()
      .update(Folder)
      .where("id = :id", { id: folderId })
      .set(await prepareDataForDB(body as unknown as Record<string, unknown>, ["name", "isWritable"]))
      .execute();
  
    const updatedFolder = await dataSource
      .getRepository(Folder)
      .findOneBy({
        id: folderId
      });
  
    res.status(200).json(updatedFolder);
  } catch (err) {
    res.status(401).json(
      { error: "encountered error: " + Helper.assertError(err).toString() }
    );
  
    return;
  }
});
  
/**
   * @openapi
   * /folder/:folderId/download/globus-init:
   *  post:
   *      description: Posts a request to initiate a globus download of the specified folder (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Globus download of the specific folder is successful
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          403:
   *              description: Returns error when the folder ID cannot be found, when the hpc config for globus cannot be found, when the globus download fails, or when a download is already running for the folder
   */
folderRouter.post(
  "/:folderId/download/globus-init", 
  authMiddleWare, 
  async function (req, res) {
    const errors = requestErrors(
      validator.validate(req.body, schemas.initGlobusDownload)
    );
    
    if (errors.length > 0) {
      res.status(402).json({ error: "invalid input", messages: errors });
      return;
    }
    
    const body = req.body as initGlobusDownloadBody;
    
    if (!res.locals.username) {
      res.status(402).json({ error: "invalid token" });
      return;
    }
    
    // get jobId from body
    const jobId = body.jobId;
    
    // get folder; if not found, error out
    const folderId = req.params.folderId;
    const folder = await (dataSource
      .getRepository(Folder)
      .findOneByOrFail({
        id: folderId
      })
    );
        
    if (!folder) {
      res.status(403).json({ error: `cannot find folder with id ${folderId}` });
      return;
    }
    
    // check if there is an existing globus job from the redis DB -- if so, error out
    const existingTransferJob: string | null = (
      await globusTaskList.get(folderId)
    );
    
    if (existingTransferJob) {
      res.status(403).json({
            error: `a globus job is currently running on folder with id ${folderId}`,  // eslint-disable-line
      });
      return;
    }
    
    // get jupyter globus config
    const hpcConfig = hpcConfigMap[folder.hpc];
    if (!hpcConfig) {
      res.status(403).json({ error: `cannot find hpc ${folder.hpc}` });
      return;
    }
    
    // init transfer
    const fromPath: string = (body.fromPath !== undefined
      ? path.join(folder.globusPath, body.fromPath)
      : folder.globusPath);
    const from: GlobusFolder = { type: "globus", path: fromPath, endpoint: hpcConfig.globus.endpoint };
    const to: GlobusFolder = { path: body.toPath, endpoint: body.toEndpoint, type: "globus" };
    // console.log(from, to);
    
    try {
      // start the transfer
      const globusTaskId = await GlobusClient.initTransfer(
        from,
        to,
        `job-id-${jobId}-download-folder-${folder.id}`
      );

      // record the task as ongoing for the given folder
      await globusTaskList.put(folderId, globusTaskId);
      res.json({ globus_task_id: globusTaskId });
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: `failed to init globus with error: ${Helper.assertError(err).toString()}`
        });
      return;
    }
  }
);
  
/**
   * @openapi
   * /folder/:folderId/download/globus-status:
   *  get:
   *      description: Gets the status of a globus download job currenty happening on the given folder ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns status of current globus download (if no download is occuring {} is returned)
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
   *          403:
   *              description: Returns error when the folder ID cannot be found or when the globus query fails
   */
folderRouter.get(
  "/:folderId/download/globus-status", 
  authMiddleWare, 
  async function (req, res) {
    if (!res.locals.username) {
      res.status(402).json({ error: "invalid token" });
      return;
    }
  
    // get folder -- if doesn't exist, error out
    const folderId = req.params.folderId;
    const folder = await (dataSource
      .getRepository(Folder)
      .findOneByOrFail({
        id: folderId
      })
    );
  
    if (!folder) {
      res.status(403).json({ error: `cannot find folder with id ${folderId}` });
      return;
    }
  
    // query status
    const globusTaskId = await globusTaskList.get(folderId);
    try {
      if (!globusTaskId) {
        throw new Error("No task id found.");
      }
  
      const status = await GlobusClient.queryTransferStatus(
        globusTaskId,
      );
  
      // remove the folder from the ongoing globus task list if the globus transfer finished
      if (["SUCCEEDED", "FAILED"].includes(status))
        await globusTaskList.remove(folderId);  
  
      res.json({ status: status });
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: `failed to query globus with error: ${Helper.assertError(err).toString()}`
        });
      return;
    }
  }
);

export default folderRouter;