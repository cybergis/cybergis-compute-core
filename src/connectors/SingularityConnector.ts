import SlurmConnector from './SlurmConnector'
import { slurm } from '../types'

class SingularityConnector extends SlurmConnector {
    execCommandWithinImage(image: string, cmd: string, config: slurm) {
        cmd = `singularity exec --bind ${this.getRemoteExecutableFilePath()}:/${this.jobID} ${image} ${cmd}`
        super.prepare(cmd, config)
    }

    runImage(image: string, config: slurm) {
        var cmd = `singularity run ${image}`
        super.prepare(cmd, config)
    }
}

export default SingularityConnector