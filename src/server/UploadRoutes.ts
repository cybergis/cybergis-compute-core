import express from "express";
import fileUpload from "express-fileupload";

import { config } from "../../configs/config";
import { InitBrowserUploadBodySchema } from "../definitions";
import * as Helper from "../helpers/Helper";
import { Job } from "../models";
import dataSource from "../utils/DB";

import { validateZodSchema, authMiddleWare } from "./ServerUtil";

const uploadRouter = express.Router();

uploadRouter.use(// uploading files
  fileUpload({
    limits: { fileSize: config.local_file_system.limit_in_mb * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: config.local_file_system.cache_path,
    safeFileNames: true,
    limitHandler: (req, res, _next) => {
      res.json({ error: "file too large" });
      res.status(402);
    },
    parseNested: true,
  })
);

uploadRouter.post(
  "/",
  authMiddleWare,
  async function (req, res) {
    if (!req.files || Object.keys(req.files).length === 0 || !req.files.file) {
      return res.status(400).json({ error: "no files were uploaded/file should be uploaded under file" }); 
    }

    const uploadedFile = req.files.file;

    if (Array.isArray(uploadedFile)) {
      return res.status(400).json({ error: "only accept uploads of single zip files" });
    }

    const validation = validateZodSchema(InitBrowserUploadBodySchema, req.body);
  
    if (!validation.success) {
      res.status(402).json({ error: "invalid input", messages: validation.errors });
      return;
    }

    if (
      (uploadedFile.mimetype !== "application/zip" && uploadedFile.mimetype !== "application/x-zip-compressed")
      || !uploadedFile.name.toLowerCase().endsWith("zip")
    ) {
      return res.status(400).json({ error: "only accept zip files" });
    }

    const localFilePath = uploadedFile.tempFilePath;

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
        .set(
          {
            localDataFolder: { 
              type: "local", 
              localFilePath: localFilePath
            }
          }
        )
        .where("id = :id", { id: jobId })
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
      return res.status(402).json({ error: "Updated job not found in the database." });
    } else {
      return res.status(200).json(Helper.job2object(job));
    }

    
  }
);

export default uploadRouter;
