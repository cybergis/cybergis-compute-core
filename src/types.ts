/* eslint-disable no-unused-vars */
import NodeSSH = require("node-ssh");
import { ConnectConfig } from "ssh2";
import { Prompt } from "ssh2-streams";
import { Folder } from "./models/Folder";

type unit = "GB" | "MB" | "Minutes" | "Hours" | "Days" | "None";

export const slurm_configs = [
  "num_of_node",
  "num_of_task",
  "time",
  "cpu_per_task",
  "memory_per_cpu",
  "memory_per_gpu",
  "memory",
  "gpus",
  "gpus_per_node",
  "gpus_per_socket",
  "gpus_per_task",
  "partition",
];
export const slurm_integer_configs = [
  "num_of_node",
  "num_of_task",
  "time",
  "cpu_per_task",
  "memory_per_cpu",
  "memory_per_gpu",
  "memory",
  "gpus",
  "gpus_per_node",
  "gpus_per_socket",
  "gpus_per_task",
];
export const slurm_integer_storage_unit_config = [
  "memory_per_cpu",
  "memory_per_gpu",
  "memory",
];
export const slurm_integer_time_unit_config = ["time"];
export const slurm_integer_none_unit_config = [
  "cpu_per_task",
  "num_of_node",
  "num_of_task",
  "gpus",
  "gpus_per_node",
  "gpus_per_socket",
  "gpus_per_task",
];
export const slurm_string_option_configs = ["partition"];

export interface integerRule {
  type?: "integer";
  max?: number;
  min?: number;
  step?: number;
  default_value: number;
  unit?: unit;
}

export interface stringOptionRule {
  type?: "string_option";
  options: string[];
  default_value: string;
}

export interface stringInputRule {
  type?: "string_input";
  default_value: string;
}

export interface slurmInputRules {
  num_of_node?: integerRule;
  num_of_task?: integerRule;
  time?: integerRule;
  cpu_per_task?: integerRule;
  memory_per_cpu?: integerRule;
  memory_per_gpu?: integerRule;
  memory?: integerRule;
  gpus?: integerRule;
  gpus_per_node?: integerRule;
  gpus_per_socket?: integerRule;
  gpus_per_task?: integerRule;
  partition?: stringOptionRule;
}

export interface rawAccessToken {
  alg: string;
  payload: {
    encoded: string;
    decoded: unknown;
  };
  hash: string;
  id: string;
}

export interface secretToken {
  usr: string;
  sT: string;
}

export interface credential {
  id: string;
  user?: string;
  password?: string;
}

export interface slurm {
  time?: string;
  num_of_node?: number;
  num_of_task?: number;
  cpu_per_task?: number;
  memory?: string;
  memory_per_cpu?: string;
  memory_per_gpu?: string;
  gpus?: number;
  gpus_per_node?: number | string;
  gpus_per_socket?: number | string;
  gpus_per_task?: number | string;
  partition?: string;
  mail_type?: string[];
  mail_user?: string[];
  modules?: string[];
}

export interface secretTokenCache {
  cred: {
    usr: string;
    pwd: string;
  };
  hpc: string;
  sT: string;
}

export interface options {
  cwd?: string;
  execOptions?: unknown;
  encoding?: BufferEncoding;
}

export interface localKey {
  private_key_path: string;
  passphrase?: unknown;
}

export interface redis {
  host: string;
  port: number;
  password?: unknown;
}

export interface mysql {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface localFileSystem {
  limit_in_mb: number;
  cache_path: string;
  root_path: string;
}

export interface config {
  local_key: localKey;
  server_port: number;
  server_ip: string;
  redis: redis;
  mysql: mysql;
  globus_client_id: string;
  local_file_system: localFileSystem;
  queue_consume_time_period_in_seconds: number;
  is_testing: boolean;
  is_jest: boolean; // reserve only for jest testing
}

export interface externalKey {
  private_key_path: string;
  passphrase: string | null;
}

export interface communityLogin {
  user: string;
  use_local_key: boolean;
  external_key: externalKey;
}

export interface hpcConfig {
  ip: string;
  port: number;
  is_community_account: boolean;
  community_login: communityLogin;
  root_path: string;
  job_pool_capacity: number;
  init_sbatch_script: string[];
  init_sbatch_options: string[];
  description?: string;
  globus?: {
    identity: string;
    endpoint: string;
    root_path: string;
  };
  mount: Record<string, string>;
  slurm_input_rules?: slurmInputRules;
  slurm_global_cap: slurm;
  xsede_job_log_credential: XSEDEJobLogCredential;
  allowlist: string[];
  denylist: string[];
}

export interface XSEDEJobLogCredential {
  xsederesourcename: string;
  apikey: string;
}

export interface jupyterGlobusMapConfig {
  comment: string;
  endpoint: string;
  root_path: string;
  container_home_path: string;
  user_mapping?: string;
}

export interface announcement {
  poster: string;
  message: string;
  time_stamp: string;
}

export interface announcementsConfig {
  announcements: announcement[];
}

export interface fileConfig {
  ignore: string[];
  must_have: string[];
  ignore_everything_except_must_have: boolean;
}

export interface maintainerConfig {
  hpc: string[];
  default_hpc: string;
  maintainer: string;
}

export interface executableManifest {
  name: string;
  container: string;
  connector?: string;
  pre_processing_stage?: string;
  execution_stage: string;
  post_processing_stage?: string;
  pre_processing_stage_in_raw_sbatch?: string[];
  execution_stage_in_raw_sbatch?: string[];
  post_processing_stage_in_raw_sbatch?: string[];
  description?: string;
  estimated_runtime?: string;
  supported_hpc?: string[];
  default_hpc?: string;
  repository?: string;
  require_upload_data?: boolean;
  slurm_input_rules?: slurmInputRules;
  param_rules?: Record<string, stringOptionRule | integerRule>;
  default_result_folder_downloadable_path?: string;
}

export interface containerConfig {
  dockerfile?: string;
  dockerhub?: string;
  hpc_path: Record<string, string>;
  mount: Record<string, Record<string, string>>;
}

export interface kernelConfig {
  env: string[];
}

export interface event {
  type: string;
  message: string;
}

export declare type SSHConfig = ConnectConfig & {
  password?: string;
  privateKey?: string;
  tryKeyboard?: boolean;
  onKeyboardInteractive?: (
    name: string,
    instructions: string,
    lang: string,
    prompts: Prompt[],
    finish: (responses: string[]) => void
  ) => void;
};

export interface SSH {
  connection: NodeSSH;
  config: SSHConfig;
}

export interface jobMaintainerUpdatable {
  param?: Record<string, string>;
  env?: Record<string, string>;
  slurm?: slurm;
  slurmId?: string;
  nodes?: number;
  cpus?: number;
  cpuTime?: number;
  memory?: number;
  memoryUsage?: number;
  walltime?: number;
  remoteResultFolder?: Folder;
  remoteExecutableFolder?: Folder;
  remoteDataFolder?: Folder;
}

export interface GlobusFolder {
  type?: string;
  endpoint: string;
  path: string;
}

export interface GitFolder {
  type?: string;
  gitId: string;
}

export interface LocalFolder {
  localPath: string;
  type?: string;
}

export interface EmptyFolder {
  type: string;
}

export interface folderEditable {
  name: string;
  isWritable: boolean;
}

export type NeedUploadFolder = 
  GlobusFolder | GitFolder | LocalFolder;

export type AnyFolder = NeedUploadFolder | EmptyFolder;

export interface authReqBody {
  jupyterhubApiToken: string
}

export interface updateFolderBody { 
  jupyterhubApiToken: string, 
  name?: string, 
  isWritable?: boolean 
}

export interface initGlobusDownloadBody { 
  jupyterhubApiToken: string, 
  toEndpoint: string, 
  toPath: string, 
  jobId?: string, 
  fromPath?: string 
}

export interface createJobBody { 
  jupyterhubApiToken: string, 
  maintainer?: string, 
  hpc?: string, 
  user?: string, 
  password?: string 
}

export interface updateJobBody {
  jupyterhubApiToken: string,
  param?: object,
  env?: object,
  slurm?: object,
  localExecutableFolder?: object,
  localDataFolder?: object,
  remoteDataFolder?: object,
  remoteExecutableFolder?: object,
}

export interface refreshCacheBody {
  hpc?: string
}

export type PushFunction = (_args: unknown[]) => Promise<number>;
export type ShiftFunction = (_key: unknown) => Promise<unknown>;
export type PeekFunction = (
  _key: unknown, 
  _start: number, 
  _end: number
) => Promise<unknown>;
export type LengthFunction = (_key: unknown) => Promise<number>;

export type GetValueFunction = (_key: unknown) => Promise<string>;
export type SetValueFunction = (
  _key: unknown, 
  _value: string
) => Promise<string>;  // possibly not string
export type DelValueFunction = (_keys: unknown) => Promise<number>;