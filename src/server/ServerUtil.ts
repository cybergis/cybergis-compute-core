import { Request, NextFunction, Response } from "express";
import { z, ZodError } from "zod";

import {
  AuthReqBodySchema,
} from "../definitions";
import { Folder } from "../models/Folder";
import dataSource from "../utils/DB";
import JupyterHub from "../utils/JupyterHub";
import { ResultFolderContentManager, GlobusTaskListManager } from "../utils/Redis";
import { SSHCredentialGuard } from "../utils/SSHCredentialGuard";
import Statistic from "../utils/Statistic";
import Supervisor from "../utils/Supervisor";

// global object instantiation
export const supervisor = new Supervisor();
export const sshCredentialGuard = new SSHCredentialGuard();
export const resultFolderContent = new ResultFolderContentManager();
// export const jupyterHub = new JupyterHub();
// export const statistic = new Statistic();
export const globusTaskList = new GlobusTaskListManager();

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

export function validateZodSchema<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: string[], data?: T } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      return { success: false, errors: err.errors.map((error) => error.message) };
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
