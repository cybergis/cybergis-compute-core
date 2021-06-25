import BaseMaintainer from './maintainers/BaseMaintainer'
import { ConnectConfig } from 'ssh2';
import { Prompt } from 'ssh2-streams';
import NodeSSH = require('node-ssh')

export interface rawAccessToken {
    alg: string
    payload: {
        encoded: string
        decoded: any
    },
    hash: string
    id: string
}

export interface secretToken {
    usr: string
    sT: string
}

export interface credential {
    id: string
    user: string
    password: string
}

export interface slurm {
    walltime?: number
    num_of_node?: number
    num_of_task?: number
    cpu_per_task?: number
    memory_per_cpu?: string
}

export interface secretTokenCache {
    cred: {
        usr: string
        pwd: string
    },
    hpc: string
    sT: string
}

export interface options {
    cwd?: string
    execOptions?: any
    encoding?: BufferEncoding
}

export interface localKey {
    private_key_path: string
    passphrase?: any
}

export interface redis {
    host: string
    port: number
    password?: any
}

export interface mysql {
    host: string
    port: number
    database: string
    username: string
    password: string
}

export interface localFileSystem {
    limit_in_mb: number
    cache_path: string
    root_path: string
}

export interface config {
    local_key: localKey
    server_port: number
    server_ip: string
    redis: redis
    mysql: mysql
    local_file_system: localFileSystem
    worker_time_period_in_seconds: number
    is_testing: boolean
}

export interface externalKey {
    private_key_path: string
    passphrase: string | null
}

export interface communityLogin {
    user: string
    use_local_key: boolean
    external_key: externalKey
}

export interface hpcConfig {
    ip: string
    port: number
    is_community_account: boolean
    community_login: communityLogin
    root_path: string
}

export interface fileConfig {
    ignore: string[]
    must_have: string[]
    ignore_everything_except_must_have: boolean
}

export interface gitConfig {
    url: string,
    sha?: string
}

export interface executableFolder {
    from_user: boolean
    allowed_protocol: 'git' | 'local' | Array<string>
    file_config: fileConfig
}

export interface maintainerConfig {
    hpc: string[]
    default_hpc: string
    job_pool_capacity: number
    executable_folder: executableFolder
    maintainer: string
}

export interface executableManifest {
    name: string
    container: string
    setup_stage?: string
    execution_stage: string
    cleanup_stage?: string
}

export interface containerConfig {
    dockerfile?: string
    dockerhub?: string
    hpc_path: {[keys: string]: string}
}

export interface event {
    type: string
    message: string
}

export declare type SSHConfig = ConnectConfig & {
    password?: string
    privateKey?: string
    tryKeyboard?: boolean
    onKeyboardInteractive?: (name: string, instructions: string, lang: string, prompts: Prompt[], finish: (responses: string[]) => void) => void
}

export interface SSH {
    connection: NodeSSH
    config: SSHConfig
}