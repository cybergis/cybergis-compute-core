import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm } from '../types'
import * as path from 'path'

class SlurmConnector extends BaseConnector {

    public job_executable_file_path: string

    public job_slurm_id: string

    prepare(image: string, cmd: string, config: slurm) {
        this.job_executable_file_path = path.join(this.config.root_path, this.maintainer.id)

        config = Object.assign({
            walltime: 1,
            num_of_node: 1,
            num_of_task: 1,
            cpu_per_task: 1,
            memory_per_cpu: '2G'
        }, config)

        var walltime = config.walltime < 10 ? '0' + config.walltime : config.walltime
        walltime += ':00:00' // 01:00:00

        // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
        var template = `#!/bin/bash
#SBATCH --job-name=${this.jobID}                 # create a short name for your job
#SBATCH --nodes=${config.num_of_node}            # node count
#SBATCH --ntasks=${config.num_of_task}           # total number of tasks across all nodes
#SBATCH --cpus-per-task=${config.cpu_per_task}   # cpu-cores per task (>1 if multi-threaded tasks)
#SBATCH --mem-per-cpu=${config.memory_per_cpu}   # memory per cpu-core (4G is default)
#SBATCH --time=${walltime}                       # total run time limit (HH:MM:SS)

module load singularity
srun --mpi=pmi2 singularity exec ${image} ${cmd} --bind ${this.job_executable_file_path}:/${this.maintainer.id}`

        this.maintainer.executable_file.putFromTemplate(template, {}, 'job.slurm')
    }

    async submit() {
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_UPLOAD', `uploading executable files`)
        await this.upload(this.maintainer.executable_file, this.job_executable_file_path)

        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT', `submitting slurm job`)
        var sbatchResult = (await this.exec(`sbatch job.slurm`, {
            cwd: this.job_executable_file_path
        })).stdout

        if (sbatchResult.includes('ERROR') || sbatchResult.includes('WARN')) {
            if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_ERROR', 'cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
            throw new ConnectorError('cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
        }

        this.job_slurm_id = sbatchResult.split(/[ ]+/).pop()
    }

    // Job id              Name             Username        Time Use S Queue          
    // ------------------- ---------------- --------------- -------- - ---------------
    // 3142249             singularity      cigi-gisolve    00:00:00 R node           
    async getStatus(mute = false) {
        var statusResult = (await this.exec(`qstat ${this.job_slurm_id}`, {}, mute)).stdout
        if (statusResult == null) return 'UNKNOWN'
        var i = statusResult.split(/[ ]+/).indexOf(this.job_slurm_id)
        try {
            return statusResult[i + 4]
        } catch (e) {
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SLURM_GET_STATUS_ERROR', 'cannot parse status result ' + statusResult)
            throw new ConnectorError('cannot parse status result ' + statusResult)
        }
    }

    async cancel() {
        await this.exec(`scancel ${this.job_slurm_id}`)
    }

    async pause() {
        await this.exec(`scontrol suspend ${this.job_slurm_id}`)
    }

    async resume() {
        await this.exec(`scontrol resume ${this.job_slurm_id}`)
    }

    getExecutableFilePath(): string {
        return this.job_executable_file_path
    }
}

export default SlurmConnector