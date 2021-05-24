import SlurmConnector from './SlurmConnector'
import { slurm } from '../types'
import * as path from 'path'

class SingularityConnector extends SlurmConnector {
    private volumeBinds: {[keys: string]: string} = {}

    execCommandWithinImage(image: string, cmd: string, config: slurm) {
        this.volumeBinds[this.getRemoteExecutableFolderPath()] = this.getContainerExecutableFolderPath()
        this.volumeBinds[this.getRemoteResultFolderPath()] = this.getContainerResultFolderPath()
        var bindCMD: Array<string>= []
        for (var from in this.volumeBinds) {
            var to = this.volumeBinds[from]
            bindCMD.push(`--bind ${from}:${to}`)
        }
        cmd = `singularity exec ${bindCMD.join(' ')} ${image} ${cmd}`
        super.prepare(cmd, config)
    }

    runImage(image: string, config: slurm) {
        var cmd = `singularity run ${image}`
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
}

export default SingularityConnector