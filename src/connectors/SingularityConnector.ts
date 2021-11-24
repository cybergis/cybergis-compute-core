import SlurmConnector from './SlurmConnector'
import { slurm, executableManifest } from '../types'
import { containerConfigMap } from '../../configs/config'

class SingularityConnector extends SlurmConnector {
    private volumeBinds: {[keys: string]: string} = {}

    public isContainer = true

    execCommandWithinImage(image: string, cmd: string, config: slurm) {
        cmd = `srun --mpi=pmi2 singularity exec ${this._getVolumeBindCMD()} ${image} ${cmd}`
        super.prepare(cmd, config)
    }

    execExecutableManifestWithinImage(manifest: executableManifest, config: slurm) {
        var container = containerConfigMap[manifest.container]
        if (!container) throw new Error(`unknown container ${manifest.container}`)
        var containerPath = container.hpc_path[this.hpcName]
        if (!containerPath) throw new Error(`container ${manifest.container} is not supported on HPC ${this.hpcName}`)
        // remove buffer: https://dashboard.hpc.unimelb.edu.au/job_submission/

        var jobENV = this._getJobENV()
        var cmd = ``

        if (manifest.pre_processing_stage_in_raw_sbatch) {
            for (var i in manifest.pre_processing_stage_in_raw_sbatch) {
                cmd += `${manifest.pre_processing_stage_in_raw_sbatch[i]}\n`
            }
        } else if (manifest.pre_processing_stage) {
            cmd += `${jobENV.join(' ')} singularity exec ${this._getVolumeBindCMD(manifest)} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.pre_processing_stage}\"\n\n`
        }

        if (manifest.execution_stage_in_raw_sbatch) {
            for (var i in manifest.execution_stage_in_raw_sbatch) {
                cmd += `${manifest.execution_stage_in_raw_sbatch[i]}\n`
            }
        } else {
            cmd += `${jobENV.join(' ')} srun --unbuffered --mpi=pmi2 singularity exec ${this._getVolumeBindCMD(manifest)} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.execution_stage}"\n\n`
        }

        if (manifest.post_processing_stage_in_raw_sbatch) {
            for (var i in manifest.post_processing_stage_in_raw_sbatch) {
                cmd += `${manifest.post_processing_stage_in_raw_sbatch[i]}\n`
            }
        } else if (manifest.post_processing_stage) {
            cmd += `${jobENV.join(' ')} singularity exec ${this._getVolumeBindCMD(manifest)} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.post_processing_stage}\"`
        }

        super.prepare(cmd, config)
    }

    runImage(image: string, config: slurm) {
        var jobENV = this._getJobENV()
        var cmd = `srun --mpi=pmi2 ${jobENV.join(' ')} singularity run ${this._getVolumeBindCMD()} ${image}`
        super.prepare(cmd, config)
    }

    registerContainerVolumeBinds(volumeBinds: {[keys: string]: string}) {
        for (var from in volumeBinds) {
            var to = volumeBinds[from]
            this.volumeBinds[from] = to
        }
    }

    private _getVolumeBindCMD(manifest: executableManifest | null = null) {
        this.volumeBinds[this.getRemoteExecutableFolderPath()] = this.getContainerExecutableFolderPath()
        this.volumeBinds[this.getRemoteResultFolderPath()] = this.getContainerResultFolderPath()
        this.volumeBinds[this.getRemoteDataFolderPath()] = this.getContainerDataFolderPath()

        if (manifest) {
            var container = containerConfigMap[manifest.container]
            if (container) {
                if (container.mount) {
                    if (container.mount[this.hpcName]) {
                        for (var i in container.mount[this.hpcName]) {
                            this.volumeBinds[i] = container.mount[this.hpcName][i]
                        }
                    }
                }
            }
        }

        var bindCMD: Array<string>= []
        for (var from in this.volumeBinds) {
            var to = this.volumeBinds[from]
            bindCMD.push(`${from}:${to}`)
        }
        return `--bind ${bindCMD.join(',')}`
    }

    private _getJobENV(): string[] {
        var jobJSON = {
            job_id: this.maintainer.job.id,
            user_id: this.maintainer.job.userId,
            maintainer: this.maintainer.job.maintainer,
            hpc: this.maintainer.job.hpc,
            param: this.maintainer.job.param,
            env: this.maintainer.job.env,
            executable_folder: this.isContainer ? this.getContainerExecutableFolderPath() : this.getRemoteExecutableFolderPath(),
            data_folder: this.isContainer ? this.getContainerDataFolderPath() : this.getRemoteDataFolderPath(),
            result_folder: this.isContainer ? this.getContainerResultFolderPath() : this.getRemoteResultFolderPath()
        }

        var jobENV = []
        for (var key in jobJSON) {
            var structuredKeys = ['param', 'env']
            if (structuredKeys.includes(key)) {
                for (var i in jobJSON[key]) {
                    jobENV.push(`${key}_${i}="${jobJSON[key][i]}"`)
                }
            } else {
                jobENV.push(`${key}="${jobJSON[key]}"`)
            }
        }

        return jobENV
    }
}

export default SingularityConnector