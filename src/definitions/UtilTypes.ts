import NodeSSH from "node-ssh";
import { ConnectConfig } from "ssh2";
import { Prompt } from "ssh2-streams";

import { Folder } from "../models";

import { slurm } from "./JobTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type callableFunction = (..._args: any[]) => unknown;

export interface options {
  cwd?: string;
  execOptions?: unknown;
  encoding?: BufferEncoding;
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

export declare type SSH = NodeSSH;

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