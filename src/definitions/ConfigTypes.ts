import { slurm, slurmInputRules } from "./JobTypes";

export interface localKey {
    private_key_path: string;
    passphrase?: unknown;
  }
  
export interface redis {
    host: string;
    port: number;
    password?: string;
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

export interface baseConfig {
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
  globus: {
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
  allocation?: string;
  partition?: string;
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
  globus: {
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
  allocation?: string;
  partition?: string;
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

export interface containerConfig {
    dockerfile?: string;
    dockerhub?: string;
    hpc_path: Record<string, string>;
    mount: Record<string, Record<string, string>>;
  }
  
export interface kernelConfig {
    env: string[];
  }