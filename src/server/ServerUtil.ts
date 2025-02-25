import { Request, NextFunction, Response } from "express";
import jsonschema = require("jsonschema");

import { Folder } from "../models/Folder";
import dataSource from "../utils/DB";
import JupyterHub from "../utils/JupyterHub";
import { ResultFolderContentManager, GlobusTaskListManager } from "../utils/Redis";
import { SSHCredentialGuard } from "../utils/SSHCredentialGuard";
import Statistic from "../utils/Statistic";
import Supervisor from "../utils/Supervisor";
import type {
  authReqBody,
  updateFolderBody,
} from "../utils/types";


// global object instantiation
export const supervisor = new Supervisor();
export const validator = new jsonschema.Validator();
export const sshCredentialGuard = new SSHCredentialGuard();
export const resultFolderContent = new ResultFolderContentManager();
export const jupyterHub = new JupyterHub();
export const statistic = new Statistic();
export const globusTaskList = new GlobusTaskListManager();

// object for vadidating API calls
export const schemas = {
  user: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  cancel: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      jobId: { type: "string" },
    },
    required: ["jupyterhubApiToken", "jobId"],
  },
  updateFolder: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      name: { type: "string" },
      isWritable: { type: "boolean" },
    },
    required: ["jupyterhubApiToken"],
  },
  updateJob: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      param: { type: "object" },
      env: { type: "object" },
      slurm: { type: "object" },
      localExecutableFolder: { type: "object" },
      localDataFolder: { type: "object" },
      remoteDataFolder: { type: "string" },
      remoteExecutableFolder: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  createJob: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      maintainer: { type: "string" },
      hpc: { type: "string" },
      user: { type: "string" },
      password: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  initGlobusDownload: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      jupyterhubApiToken: { type: "string" },
      toEndpoint: { type: "string" },
      toPath: { type: "string" },
      fromPath: { type: "string" },
    },
    required: ["jupyterhubApiToken", "toEndpoint", "toPath"],
  },
  refreshCache: {
    type: "object",
    properties: {
      hpc: { type: "string" },
    }
  }
};

// handler for route errors
export function requestErrors(v: jsonschema.ValidatorResult): string[] {
  if (v.valid) return [];

  const errors: string[] = [];
  for (const error of v.errors) errors.push(error.message);

  return errors;
}

// function to take data and get it into dictionary format for DB interfacing
export async function prepareDataForDB(
  data: Record<string, unknown>, 
  properties: string[]
): Promise<Record<string, string | Folder>> {
  const out: Record<string, string | Folder> = {};

  for (const property of properties) {
    if (data[property]) {
      if (
        property === "remoteExecutableFolder" ||
        property === "remoteDataFolder"
      ) {
        const folder: Folder | null = await (dataSource.
          getRepository(Folder).
          findOneBy({
            id: data[property] as string
          })
        );

        if (!folder) throw new Error("could not find " + property);

        out[property] = folder;
      } else {
        out[property] = data[property as keyof updateFolderBody] as string;
      }
    }
  }

  return out;
}

export const authMiddleWare = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const body = req.body as authReqBody;
  
  // if there is an api token in the body
  if (body.jupyterhubApiToken) {
    try {
      // try to extract username/host and store into local variables
      res.locals.username = await jupyterHub.getUsername(
        body.jupyterhubApiToken
      );
      res.locals.host = jupyterHub.getHost(body.jupyterhubApiToken);
    } catch {}

    // continue onto the actual route
    next();
  // if there isn't, just give a 402 error
  } else {
    res.status(402).json(
      { error: "Malformed input. No jupyterhub api token passed with request." }
    );
  }
};