import BaseMaintainer from './maintainers/BaseMaintainer'

export interface rawAccessToken {
    alg: string,
    payload: {
        encoded: string,
        decoded: any
    },
    hash: string
}

export interface secretToken {
    usr: string,
    sT: string
}

export interface slurm {
    walltime?: number,
    num_of_node?: number,
    num_of_task?: number,
    cpu_per_task?: number,
    memory_per_cpu?: string
}

export interface manifest {
    aT?: string,
    sT?: string,
    cred?: {
        usr: string,
        pwd: string
    },
    uid?: number,
    id?: string,
    dest?: string,
    maintainer?: string,
    _maintainer?: BaseMaintainer,
    hpc?: string,
    env?: {[keys: string]: string},
    app?: {[keys: string]: string},
    file?: string,
    slurm?: slurm
}

export interface secretTokenCache {
    cred: {
        usr: string,
        pwd: string
    },
    hpc: string,
    sT: string
}

export interface options {
    cwd?: string,
    execOptions?: any,
    encoding?: BufferEncoding
}

export interface localKey {
    private_key_path: string;
    passphrase?: any;
}

export interface redis {
    host: string;
    port: number;
    password?: any;
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
    local_file_system: localFileSystem;
    worker_time_period_in_seconds: number;
    is_testing: boolean
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
    connector: string;
    root_path: string;
}

export interface fileConfig {
    ignore: string[];
    must_have: string[];
    ignore_everything_except_must_have: boolean;
}

export interface executableFile {
    from_user_upload: boolean;
    file_config: fileConfig;
}

export interface maintainerConfig {
    hpc: string[];
    default_hpc: string;
    job_pool_capacity: number;
    executable_file: executableFile;
    maintainer: string;
}

export interface event {
    type: string
    message: string
}