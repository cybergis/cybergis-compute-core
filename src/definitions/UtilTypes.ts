import { NodeSSH, Config } from "node-ssh";

import { Folder } from "../models";

import { slurm } from "./JobTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type callableFunction = (..._args: any[]) => unknown;

export interface options {
  cwd?: string;
  execOptions?: unknown;
  encoding?: BufferEncoding;
}

export type SSHConfig = Config;

export type SSH = NodeSSH;

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

export interface GlobusAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token: string;
  scope: string;
}

export enum ApprovalType {
  APPROVAL = "approval",
  DENIAL = "deny"
}

export interface CILogonTokenBody {
  access_token: string,
  id_token: string,
  token_type: string,
  expires_in: number
}

export interface CILogonUserInfo {
  email?: string,
  name?: string,
  idp?: string,
  idp_name?: string
  sub?: string,
  nbf?: number
  eppn?: string
}