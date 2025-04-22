import { Request, NextFunction, Response } from "express";
import { rootPath } from "get-root-path";
import { z, ZodError, ZodIssue } from "zod";

import path from "path";

import {
  AuthReqBodySchema,
  UpdateFolderBodySchema,
} from "../definitions";
import { getHost, getUsername } from "../helpers/JupyterHubUtil";
import { Folder } from "../models";
import dataSource from "../utils/DB";
import { ResultFolderContentManager, GlobusTaskListManager } from "../utils/Redis";
import { SSHCredentialGuard } from "../utils/SSHCredentialGuard";
import Supervisor from "../utils/Supervisor";


// global object instantiation
export const supervisor = new Supervisor();
export const sshCredentialGuard = new SSHCredentialGuard();
export const resultFolderContent = new ResultFolderContentManager();
export const globusTaskList = new GlobusTaskListManager();

export const localFileFolder = path.join(rootPath, "uploads");

// function to take data and get it into dictionary format for DB interfacing
/**
 *
 * @param data data to insert into DB
 * @param properties properties to add to the data
 * @throws {ReferenceError} if unable to find the folder corresponding to the remote folder passed in the database
 * @returns row encoded as a dictionary that can be added to the database
 */
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
        const folder = await (dataSource.
          getRepository(Folder).
          findOneBy({
            id: data[property] as string
          })
        );

        if (!folder) throw new ReferenceError("could not find " + property);

        out[property] = folder;
      } else {
        out[property] = data[property as keyof typeof UpdateFolderBodySchema] as string;
      }
    }
  }

  return out;
}

/**
 * 
 * @param schema schema that the data is expected to follow
 * @param data the data to validate
 * @returns interface with the validation results
 */
export function validateZodSchema<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: ZodIssue[], data?: T } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      return { success: false, errors: err.issues };
    }
    return { success: false, errors: [] };
  }
}


export const authMiddleWare = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const validation = validateZodSchema(AuthReqBodySchema, req.body);
  
  if (!validation.success) {
    res.status(402).json({ error: "invalid input", messages: validation.errors });
    return;
  }
  
  const body = validation.data;
  
  // if there is an api token in the body
  if (body.jupyterhubApiToken) {
    try {
      // try to extract username/host and store into local variables
      res.locals.username = await getUsername(
        body.jupyterhubApiToken
      );
      res.locals.host = getHost(body.jupyterhubApiToken);
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
