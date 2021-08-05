import SlurmConnector from './SlurmConnector'
import { slurm, executableManifest } from '../types'
import { containerConfigMap } from '../../configs/config'
import * as path from 'path'

class SingularityConnector extends SlurmConnector {
    private volumeBinds: {[keys: string]: string} = {}

    execCommandWithinImage(image: string, cmd: string, config: slurm) {
        cmd = `srun --mpi=pmi2 singularity exec --env-file job.env ${this._getVolumeBindCMD()} ${image} ${cmd}`
        super.prepare(cmd, config)
    }

    execExecutableManifestWithinImage(manifest: executableManifest, config: slurm) {
        var container = containerConfigMap[manifest.container]
        if (!container) throw new Error(`unknown container ${manifest.container}`)
        var containerPath = container.hpc_path[this.hpcName]
        if (!containerPath) throw new Error(`container ${manifest.container} is not supported on HPC ${this.hpcName}`)
        // remove buffer: https://dashboard.hpc.unimelb.edu.au/job_submission/

        var cmd = ``
        if (manifest.pre_processing_stage) {
            cmd += `singularity exec --env-file job.env ${this._getVolumeBindCMD()} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.pre_processing_stage}\"\n`
        }

        cmd += `srun --unbuffered --mpi=pmi2 singularity exec --env-file job.env ${this._getVolumeBindCMD()} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.execution_stage}"\n`

        if (manifest.post_processing_stage) {
            cmd += `singularity exec --env-file job.env ${this._getVolumeBindCMD()} ${containerPath} bash -c \"cd ${this.getContainerExecutableFolderPath()} && ${manifest.post_processing_stage}\"`
        }

        super.prepare(cmd, config)
    }

    runImage(image: string, config: slurm) {
        var cmd = `srun --mpi=pmi2 singularity run --env-file job.env ${this._getVolumeBindCMD()} ${image}`
        super.prepare(cmd, config)
    }

    registerContainerVolumeBinds(volumeBinds: {[keys: string]: string}) {
        for (var from in volumeBinds) {
            var to = volumeBinds[from]
            this.volumeBinds[from] = to
        }
    }

    getContainerExecutableFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/${this.jobID}/executable`, providedPath)
        else return `/${this.jobID}/executable` 
    }

    getContainerDataFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/${this.jobID}/data`, providedPath)
        else return `/${this.jobID}/data` 
    }

    getContainerResultFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/${this.jobID}/result`, providedPath)
        else return `/${this.jobID}/result`
    }

    private _getVolumeBindCMD() {
        this.volumeBinds[this.getRemoteExecutableFolderPath()] = this.getContainerExecutableFolderPath()
        this.volumeBinds[this.getRemoteResultFolderPath()] = this.getContainerResultFolderPath()
        this.volumeBinds[this.getRemoteDataFolderPath()] = this.getContainerDataFolderPath()
        var bindCMD: Array<string>= []
        for (var from in this.volumeBinds) {
            var to = this.volumeBinds[from]
            bindCMD.push(`${from}:${to}`)
        }
        return `--bind ${bindCMD.join(',')}`
    }
}

export default SingularityConnector