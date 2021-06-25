import SlurmConnector from './SlurmConnector'
import { slurm, executableManifest } from '../types'
import { containerConfigMap } from '../../configs/config'
import * as path from 'path'

class SingularityConnector extends SlurmConnector {
    private volumeBinds: {[keys: string]: string} = {}

    execCommandWithinImage(image: string, cmd: string, config: slurm) {
        cmd = `srun --mpi=pmi2 singularity exec ${this._getVolumeBindCMD()} ${image} ${cmd}`
        super.prepare(cmd, config)
    }

    execExecutableManifestWithinImage(manifest: executableManifest, config: slurm) {
        var container = containerConfigMap[manifest.container]
        if (!container) throw new Error(`unknown container ${container}`)
        var containerPath = container.hpc_path[this.hpcName]
        if (!containerPath) throw new Error(`container ${container} is not supported on HPC ${this.hpcName}`)

        var cmd = ``
        if (manifest.setup_stage) {
            var setupStage = manifest.setup_stage.replace('{{JOB_EXECUTABLE_PATH}}', this.getContainerExecutableFolderPath())
            cmd += `singularity exec ${this._getVolumeBindCMD()} ${containerPath} ${setupStage}\n`
        }

        var executionStage = manifest.execution_stage.replace('{{JOB_EXECUTABLE_PATH}}', this.getContainerExecutableFolderPath())
        cmd += `srun --mpi=pmi2 singularity exec ${this._getVolumeBindCMD()} ${containerPath}${executionStage}\n`

        if (manifest.cleanup_stage) {
            var cleanupStage = manifest.cleanup_stage.replace('{{JOB_EXECUTABLE_PATH}}', this.getContainerExecutableFolderPath())
            if (manifest.cleanup_stage) `singularity exec ${this._getVolumeBindCMD()} ${containerPath} ${cleanupStage}`
        }

        super.prepare(cmd, config)
    }

    runImage(image: string, config: slurm) {
        var cmd = `srun --mpi=pmi2 singularity run ${this._getVolumeBindCMD()} ${image}`
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
        if (providedPath) return path.join(`/${this.jobID}/data`, providedPath)
        else return `/${this.jobID}/result`
    }

    private _getVolumeBindCMD() {
        this.volumeBinds[this.getRemoteExecutableFolderPath()] = this.getContainerExecutableFolderPath()
        this.volumeBinds[this.getRemoteResultFolderPath()] = this.getContainerResultFolderPath()
        var bindCMD: Array<string>= []
        for (var from in this.volumeBinds) {
            var to = this.volumeBinds[from]
            bindCMD.push(`${from}:${to}`)
        }
        return `--bind ${bindCMD.join(',')}`
    }
}

export default SingularityConnector