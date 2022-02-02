import { ConnectConfig } from 'ssh2';
import { Prompt } from 'ssh2-streams';
import NodeSSH = require('node-ssh')

type unit = 'GB' | 'MB' | 'Minutes' | 'Hours' | 'Days' | 'None'

export const slurm_configs = ['num_of_node', 'num_of_task', 'time', 'cpu_per_task', 'memory_per_cpu', 'memory_per_gpu', 'memory', 'gpus', 'gpus_per_node', 'gpus_per_socket', 'gpus_per_task', 'partition']
export const slurm_integer_configs = ['num_of_node', 'num_of_task', 'time', 'cpu_per_task', 'memory_per_cpu', 'memory_per_gpu', 'memory', 'gpus', 'gpus_per_node', 'gpus_per_socket', 'gpus_per_task']
export const slurm_integer_storage_unit_config = ['memory_per_cpu', 'memory_per_gpu', 'memory']
export const slurm_integer_time_unit_config = ['time']
export const slurm_integer_none_unit_config = ['cpu_per_task', 'num_of_node', 'num_of_task', 'gpus', 'gpus_per_node', 'gpus_per_socket', 'gpus_per_task']
export const slurm_string_option_configs = ['partition']

export interface integerRule {
    type?: 'integer'
    max?: number
    min?: number
    step?: number
    default_value: number
    unit?: unit
}

export interface stringOptionRule {
    type?: 'string_option'
    options: string[]
    default_value: string 
}

export interface stringInputRule {
    type?: 'string_input'
    default_value: string 
}

export interface slurmInputRules {
    num_of_node?: integerRule,
    num_of_task?: integerRule,
    time?: integerRule,
    cpu_per_task?: integerRule,
    memory_per_cpu?: integerRule,
    memory_per_gpu?: integerRule,
    memory?: integerRule,
    gpus?: integerRule,
    gpus_per_node?: integerRule,
    gpus_per_socket?: integerRule,
    gpus_per_task?: integerRule,
    partition?: stringOptionRule
}

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
    time?: string
    num_of_node?: number
    num_of_task?: number
    cpu_per_task?: number
    memory?: string
    memory_per_cpu?: string
    memory_per_gpu?: string
    gpus?: number
    gpus_per_node?: number | string
    gpus_per_socket?: number | string
    gpus_per_task?: number | string
    partition?: string
    mail_type?: string[]
    mail_user?: string[]
    modules?: string[]
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
    globus_client_id: string
    local_file_system: localFileSystem
    queue_consume_time_period_in_seconds: number
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
    job_pool_capacity: number
    init_sbatch_script: string[]
    init_sbatch_options: string[]
    description?: string
    globus?: {
        identity?: string
        endpoint?: string
        root_path?: string
    }
    slurm_input_rules?: slurmInputRules
    slurm_global_cap: slurm
    xsede_job_log_credential: XSEDEJobLogCredential
}

export interface XSEDEJobLogCredential {
    xsederesourcename: string
    apikey: string
}

export interface jupyterGlobusMapConfig {
    endpoint: string
    root_path: string
    container_home_path: string
}

export interface fileConfig {
    ignore: string[]
    must_have: string[]
    ignore_everything_except_must_have: boolean
}

export interface executableFolder {
    from_user: boolean
    allowed_protocol: 'git' | 'local' | Array<string>
    file_config: fileConfig
}

export interface maintainerConfig {
    hpc: string[]
    default_hpc: string
    executable_folder: executableFolder
    maintainer: string
}

export interface executableManifest {
    name: string
    container: string
    pre_processing_stage?: string
    execution_stage: string
    post_processing_stage?: string
    pre_processing_stage_in_raw_sbatch?: string[]
    execution_stage_in_raw_sbatch?: string[]
    post_processing_stage_in_raw_sbatch?: string[]
    description?: string
    estimated_runtime?: string
    supported_hpc?: string[]
    default_hpc?: string
    repository?: string
    require_upload_data?: boolean
    slurm_input_rules?: slurmInputRules
    param_rules?: {[keys: string]: any}
}

export interface containerConfig {
    dockerfile?: string
    dockerhub?: string
    hpc_path: {[keys: string]: string},
    mount: {
        [keys: string]: {
            [keys: string]: string
        }
    }
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

export interface jobMaintainerUpdatable {
    executableFolder?: string
    dataFolder?: string
    resultFolder?: string
    param?: {[keys: string]: string}
    env?: {[keys: string]: string}
    slurm?: slurm,
    slurmId?: string
    nodes?: number
    cpus?: number
    cpuTime?: number
    memory?: number
    memoryUsage?: number
    walltime?: number
}