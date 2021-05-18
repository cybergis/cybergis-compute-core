import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm } from '../types'
import * as path from 'path'

class SlurmConnector extends BaseConnector {

    public job_executable_file_path: string = path.join(this.config.root_path, this.maintainer.id)

    public job_slurm_id: string

    public modules: Array<string> = []

    registerModules(modules: Array<string>) {
        this.modules.concat(modules)
    }

    prepare(cmd: string, config: slurm) {
        config = Object.assign({
            walltime: 1,
            num_of_node: 1,
            num_of_task: 1,
            cpu_per_task: 1,
            memory_per_cpu: '2G'
        }, config)

        var walltime = config.walltime < 10 ? '0' + config.walltime : config.walltime
        walltime += ':00:00' // 01:00:00

        var modules = ''
        for (var module in this.modules) {
            modules += `module load ${module}\n`
        }

        // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
        var template = `#!/bin/bash
#SBATCH --job-name=${this.jobID}
#SBATCH --nodes=${config.num_of_node}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --cpus-per-task=${config.cpu_per_task}
#SBATCH --mem-per-cpu=${config.memory_per_cpu}
#SBATCH --time=${walltime}
#SBATCH --error=${path.join(this.job_executable_file_path, "slurm.stdout")}
#SBATCH --output=${path.join(this.job_executable_file_path, "slurm.stdout")}

${modules}
${cmd}`
        this.maintainer.executableFile.putFromString(template, 'job.sbatch')
    }

    async submit() {
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_UPLOAD', `uploading executable files`)
        await this.upload(this.maintainer.executableFile, this.job_executable_file_path)

        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT', `submitting slurm job`)
        var sbatchResult = (await this.exec(`sbatch job.sbatch`, {
            cwd: this.job_executable_file_path
        })).stdout

        if (sbatchResult.includes('ERROR') || sbatchResult.includes('WARN')) {
            if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_ERROR', 'cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
            throw new ConnectorError('cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
        }
        this.job_slurm_id = sbatchResult.split(/[ ]+/).pop().trim()
    }

    // Job id              Name             Username        Time Use S Queue          
    // ------------------- ---------------- --------------- -------- - ---------------
    // 3142249             singularity      cigi-gisolve    00:00:00 R node           
    async getStatus(mute = false) {
        try {
            var statusResult = (await this.exec(`qstat ${this.job_slurm_id}`, {}, mute)).stdout
            if (statusResult == null) return 'UNKNOWN'
            var r = statusResult.split(/[ |\n]+/)
            var i = r.indexOf(this.job_slurm_id)
            return r[i + 4]
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

    async getSlurmOutput() {
        var out = await this.cat(path.join(this.job_executable_file_path, "slurm.stdout"))
        if (this.maintainer != null && out != null) this.maintainer.emitLog(out)
    }

    getRemoteExecutableFilePath(): string {
        return this.job_executable_file_path
    }
}

export default SlurmConnector