import { z } from "zod";

export const AuthReqBodySchema = z.object({
  jupyterhubApiToken: z.string(),
});

export const UpdateFolderBodySchema = AuthReqBodySchema.extend({
  name: z.string().optional(),
  isWritable: z.boolean().optional(),
});

export const CreateJobBodySchema = AuthReqBodySchema.extend({
  maintainer: z.string().optional(),
  hpc: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
});

export const InitGlobusDownloadBodySchema = AuthReqBodySchema.extend({
  toEndpoint: z.string(),
  toPath: z.string(),
  jobId: z.string().optional(),
  fromPath: z.string().optional()
});


export const InitBrowserDownloadBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  jobId: z.string(),
  folderId: z.string()
});


export const InitBrowserUploadBodySchema = z.object({
  jupyterhubApiToken: z.string(),
  jobId: z.string()
});

export const SlurmSchema = z.object({
  time: z.string().optional(),
  num_of_node: z.number().optional(),
  num_of_task: z.number().optional(),
  cpu_per_task: z.number().optional(),
  memory: z.string().optional(),
  memory_per_cpu: z.string().optional(),
  memory_per_gpu: z.string().optional(),
  gpus: z.number().optional(),
  gpus_per_node: z.union([z.number(), z.string()]).optional(),
  gpus_per_socket: z.union([z.number(), z.string()]).optional(),
  gpus_per_task: z.union([z.number(), z.string()]).optional(),
  partition: z.string().nullable().optional(),
  allocation: z.string().nullable().optional(),
  mail_type: z.array(z.string()).optional(),
  mail_user: z.array(z.string()).optional(),
  modules: z.string().optional()
});

const BaseFolderSchema = z.object({
});

// GlobusFolder
const GlobusFolderSchema = BaseFolderSchema.extend({
  type: z.literal("globus"),
  endpoint: z.string(),
  path: z.string()
});

// GitFolder
const GitFolderSchema = BaseFolderSchema.extend({
  type: z.literal("git"),
  gitId: z.string()
});

// LocalFolder
const LocalFolderSchema = BaseFolderSchema.extend({
  type: z.literal("local"),
  localPath: z.string()
});

// Union: NeedUploadFolder
export const NeedUploadFolderSchema = z.discriminatedUnion("type", [
  GlobusFolderSchema,
  GitFolderSchema,
  LocalFolderSchema
]);

export const UpdateJobBodySchema = AuthReqBodySchema.extend({
  param: z.record(z.unknown()).optional(),
  env: z.record(z.string()).optional(),
  slurm: SlurmSchema.optional(),
  localExecutableFolder: NeedUploadFolderSchema.optional(),
  localDataFolder: NeedUploadFolderSchema.optional(),
  remoteDataFolder: z.string().optional(),
  remoteExecutableFolder: z.string().optional()
});

export const modifyUserBodySchema = z.object({
  user: z.string(),
  hpc: z.string()
});