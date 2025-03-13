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
  "modules",
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
export const slurm_string_option_configs = ["modules", "partition"];

export interface integerRule {
  type?: "integer";
  max?: number;
  min?: number;
  step?: number;
  default_value: number;
  unit: unit;
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
  modules?: stringOptionRule;
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
  allocation?: string;
  mail_type?: string[];
  mail_user?: string[];
  modules?: string;
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

export interface event {
  type: string;
  message: string;
}
