import { z } from "zod";

export const AuthReqBodySchema = z.object({
  jupyterhubApiToken: z.string(),
});

export const UpdateFolderBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  name: z.string().optional(),
  isWritable: z.boolean().optional(),
});

export const CreateJobBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  maintainer: z.string().optional(),
  hpc: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
});

export const InitGlobusDownloadBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  toEndpoint: z.string(),
  toPath: z.string(),
  jobId: z.string().optional(),
  fromPath: z.string().optional()
});

export const InitBrowserDownloadBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  jobId: z.string()
});

export const UpdateJobBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  param: z.object({}).optional(),
  env: z.object({}).optional(),
  slurm: z.object({}).optional(),
  localExecutableFolder: z.object({}).optional(),
  localDataFolder: z.object({}).optional(),
  remoteDataFolder: z.object({}).optional(),
  remoteExecutableFolder: z.object({}).optional()
});
