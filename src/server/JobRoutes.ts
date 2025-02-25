import express = require("express");

import {
  hpcConfigMap,
  maintainerConfigMap,
} from "../../configs/config";
import * as Helper from "../helpers/Helper";
import JobUtil from "../helpers/JobUtil";
import { Job } from "../models/Job";
import dataSource from "../utils/DB";
import type {
  createJobBody,
  updateJobBody,
} from "../utils/types";

import { authMiddleWare, requestErrors, validator, schemas, sshCredentialGuard, prepareDataForDB, supervisor, resultFolderContent } from "./ServerUtil";


const jobRouter = express.Router();

/**
 * @openapi
 * /job:
 *  post:
 *      description: Posts a job to run with the corresponding metadata in the request (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns when job is successfully posted
 *          401:
 *              description: Returns an error when the request passes an unrecognized maintainer or hpc or if SSH credentials are invalid
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
jobRouter.post("/", authMiddleWare, async function (req, res) {
  const errors = requestErrors(validator.validate(req.body, schemas.createJob));
  
  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  
  const body = req.body as createJobBody;
  
  // try to extract maintainer and hpc associated with the job
  const maintainerName: string = body.maintainer ?? "community_contribution";  // default to community contribution job maintainer
  const maintainer = maintainerConfigMap[maintainerName];
  if (maintainer === undefined) {
    res.status(401).json({ error: "unrecognized maintainer", message: null });
    return;
  }
  
  const hpcName = body.hpc ? body.hpc : maintainer.default_hpc;
  const hpc = hpcConfigMap[hpcName];
  if (hpc === undefined) {
    res.status(401).json({ error: "unrecognized hpc", message: null });
    return;
  }
  
  // check if the user can use the HPC
  const allowedOnHPC = Helper.canAccessHPC(
      res.locals.username as string, 
      hpcName
  );
    // console.log(allowedOnHPC);
    
  if (!allowedOnHPC) {
    res.status(401).json({ error: "Not authorized for HPC", message: null });
    return;
  }
  
  try {
    // need to validate if hpc is not a community account
    if (!hpc.is_community_account) {
      await sshCredentialGuard.validatePrivateAccount(
        hpcName,
        body.user,
        body.password
      );
    }
  } catch (e) {
    res
      .status(401)
      .json({ 
        error: "invalid SSH credentials", 
        messages: [Helper.assertError(e).toString()] 
      });
    return;
  }
  
  // start job db connection & create the job object to upload
  const jobRepo = dataSource.getRepository(Job);
  
  const job: Job = new Job();
  job.id = Helper.generateId();
  job.userId = (res.locals.username as string 
    ? res.locals.username as string 
    : undefined
  );
  job.maintainer = maintainerName;
  job.hpc = hpcName;
  job.param = {};
  job.slurm = {};
  job.env = {};
  
  // store credentials if not community account/need verification
  if (!hpc.is_community_account)
    job.credentialId = await sshCredentialGuard.registerCredential(
      body.user,
      body.password
    );
  
  await jobRepo.save(job);
  
  res.json(Helper.job2object(job));  // return the job converted to a dictionary
});
  
/**
   * @openapi
   * /job/:jobId:
   *  put:
   *      description: Updates a job with the given job ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns updated job when it is successfully updated
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body, "invalid token" if a valid jupyter token authentication is not provided, or an error if the job does not exist
   *          403:
   *              description: Returns internal error when there is an exception while updating the job details
   */
jobRouter.put("/:jobId", authMiddleWare, async function (req, res) {
  const errors = requestErrors(validator.validate(req.body, schemas.updateJob));
  
  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  
  const body = req.body as updateJobBody;
  
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }
  
  try {
    // test if job exists
    const jobId = req.params.jobId;
    await dataSource
      .getRepository(Job)
      .findOneByOrFail({ id: jobId, userId: res.locals.username as string });
  
    // update the job with the given id
    try {
      await dataSource
        .createQueryBuilder()
        .update(Job)
        .where("id = :id", { id: jobId })
        .set(
          await prepareDataForDB(body as unknown as Record<string, unknown>, [
            "param",
            "env",
            "slurm",
            "localExecutableFolder",
            "localDataFolder",
            "remoteDataFolder",
            "remoteExecutableFolder",
          ])
        )
        .execute();
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: "internal error", 
          messages: Helper.assertError(err).toString() 
        });
      return;
    }
  
    // return updated job as a dictionary
    const job = await dataSource.getRepository(Job).findOneBy({
      id: jobId
    });
  
    if (job === null) {
      throw new Error("Updated job not found in the database.");
    }
  
    res.json(Helper.job2object(job));
  } catch (e) {
    res.json({ error: Helper.assertError(e).toString() });
    res.status(402);
  }
});
  
/**
   * @openapi
   * /job/:jobId/submit:
   *  post:
   *      description: Submits a job with the given job ID to the HPC (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns when job is successfully submitted
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in, "invalid access" if job folders are not accessible, or "job already submitted or in queue" if the job is already suibmitted
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body or a list of errors if the job does not successfully submit
   */
jobRouter.post("/:jobId/submit", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }
  
  let job: Job | null = null;
  const jobId = req.params.jobId;
  
  // try to find the specified job
  try {
    job = await dataSource.getRepository(Job).findOneOrFail({
      where: { id: jobId, userId: res.locals.username as string },
      relations: [
        "remoteExecutableFolder",
        "remoteDataFolder",
        "remoteResultFolder",
      ],
    });
  } catch (e) {
    res.status(401).json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    return;
  }
  
  // if already queued, do nothing
  if (job.queuedAt) {
    res
      .status(401)
      .json({ error: "job already submitted or in queue", messages: [] });
    return;
  }
  
  try {
    // validate job and push it to the job queue
    JobUtil.validateJob(job);
    await supervisor.pushJobToQueue(job);
  
    // update status of the job
    job.queuedAt = new Date();
    await dataSource
      .createQueryBuilder()
      .update(Job)
      .where("id = :id", { id: job.id })
      .set({ queuedAt: job.queuedAt })
      .execute();
  } catch (e) {
    res.status(402).json({ error: Helper.assertError(e).toString() });
    return;
  }
  
  res.json(Helper.job2object(job));
});
  
/**
   * @openapi
   * /job/:jobId/pause:
   *  put:
   *      description: Not yet implemented
   */
  jobRouter.put("/:jobId/pause", async function (_req, _res) { }); // eslint-disable-line
  
/**
   * @openapi
   * /job/:jobId/resume:
   *  put:
   *      description: Not yet implemented
   */
  jobRouter.put("/:jobId/resume", async function (_req, _res) { }); // eslint-disable-line
  
/**
   * @openapi
   * /job/:jobId/cancel:
   *  put:
   *      description: Cancels a job that is currently in the queue
   *      responses:
   *          200:
   *              description: Job was found successfully added to the queue to be canceled
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access token" if the events cannot be accessed
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body - jobId may be invalid or job may not be in queue
   */
jobRouter.put("/:jobId/cancel", function (req, res) {
  // console.log("made it to cancel");
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "cancel without login is not allowed", messages: [] });
    return;
  }
  
  try {
    // try to cancel the job on the supervisor job manager
    const jobId = req.params.jobId;
    const job = supervisor.cancelJob(jobId);
  
    // check if the job was successfully cancelled (per the return value from cancelJob)
    if (job === null) {
      res.status(402).json({ error: "job is not in queue or running jobs" });
      return;
    }
  
    res.status(200).json({ 
      messages: ["job successfully added to cancel queue"] 
    });
  } catch (e) {
    res.status(402).json({ 
      error: "invalid jobId", 
      messages: [Helper.assertError(e).toString()] 
    });
  }
});
  
/**
   * @openapi
   * /job/:jobId/events:
   *  get:
   *      description: Gets an array of the job events for a given job ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns array of dictionary objects containing details of each event in the process of ssubmitting and fufilling a a job
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access token" if the events cannot be accessed
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body
   */
jobRouter.get("/:jobId/events", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "listing events without login is not allowed", messages: [] });
    return;
  }
  
  try {
    // get events from the job repo (updated in the supervisor/with individual maintainers)
    const jobId = req.params.jobId;
    const job = await dataSource
      .getRepository(Job)
      .findOneOrFail({
        where: { id: jobId, userId: res.locals.username as string },
        relations: ["events"]
      });
    res.json(job.events);
  } catch (e) {
    res
      .status(401)
      .json({ 
        error: "invalid access token", 
        messages: [Helper.assertError(e).toString()] 
      });
    return;
  }
});
  
/**
   * @openapi
   * /job/:jobId/result-folder-content:
   *  get:
   *      description: Gets an array of the directories in the result folder for a given job ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns array of dirrectories in the given job"s result folder
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the folder cannot be accessed
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body
   */
jobRouter.get(
  "/:jobId/result-folder-content", 
  authMiddleWare, 
  async function (req, res) {
    if (!res.locals.username) {
      res
        .status(401)
        .json({ error: "getting results without login is not allowed", messages: [] });
      return;
    }
  
    try {
      // query the result folder content from the job repo
      const jobId = req.params.jobId;
      const job = await dataSource
        .getRepository(Job)
        .findOneByOrFail({ id: jobId, userId: res.locals.username as string });
      
      const out = await resultFolderContent.get(job.id);
      res.json(out ? out : []);
    } catch (e) {
      res.status(401).json({ 
        error: "invalid access", 
        messages: [Helper.assertError(e).toString()] 
      });
      return;
    }
  }
);
  
/**
   * @openapi
   * /job/:jobId/logs:
   *  get:
   *      description: Gets an array of dictionary objects that represent logs for the given job ID (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns array of dictionary objects that represent logs for the given job ID
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the logs cannot be accessed
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body
   */
jobRouter.get("/:jobId/logs", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(401).json({ 
      error: "getting logs without login is not allowed", 
      messages: [] 
    });
    return;
  }
  
  try {
    // try to get the logs from teh jobs database (continuously updated in the maintainer)
    const jobId = req.params.jobId;
  
    const job = await dataSource
      .getRepository(Job)
      .findOneOrFail({
        where: { id: jobId, userId: res.locals.username as string },
        relations: ["logs"]
      });
    res.json(job.logs);
  } catch (e) {
    res.status(401).json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    return;
  }
});
  
/**
   * @openapi
   * /job/:jobId:
   *  get:
   *      description: Gets a dictionary object representing the given job ID that includes information on the job as well as events, logs, and folder information (Authentication REQUIRED)
   *      responses:
   *          200:
   *              description: Returns a dictionary object representing the given job ID
   *          401:
   *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the job and job information cannot be accessed
   *          402:
   *              description: Returns "invalid input" and a list of errors with the format of the req body
   */
jobRouter.get("/:jobId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "getting job info without login is not allowed", messages: [] });
    return;
  }
  
  try {
    // query job database for all requested things, return it as a dictionary json
    const jobId = req.params.jobId;
      
    const job = await dataSource.getRepository(Job).findOneOrFail({
      where: { id: jobId, userId: res.locals.username as string },
      relations: [
        "remoteExecutableFolder",
        "remoteDataFolder",
        "remoteResultFolder",
        "events",
        "logs",
      ],
    });
    res.json(Helper.job2object(job));
  } catch (e) {
    res.json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    res.status(401);
    return;
  }
});

export default jobRouter;