import express from "express";
import fileUpload from "express-fileupload";

import { config } from "../../configs/config";
import { InitBrowserUploadBodySchema } from "../definitions";

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
  function (req, res) {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "no files were uploaded" }); 
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

    console.log(uploadedFile.tempFilePath);

    return res.status(200);
  }
);

uploadRouter.post(
  "/test",
  fileUpload(),
  function (req, res) {
    console.log(req.headers);
    console.log(req.ip);
    console.log(req.files);

    return res.status(200);
  }
);

export default uploadRouter;
