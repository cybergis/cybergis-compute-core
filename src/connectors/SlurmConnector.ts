import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm } from '../types'
import * as path from 'path'

class SlurmConnector extends BaseConnector {

    public remote_executable_folder_path: string = path.join(this.config.root_path, this.maintainer.id, 'executable')

    public remote_data_folder_path: string = path.join(this.config.root_path, this.maintainer.id, 'data')

    public remote_result_folder_path: string = path.join(this.config.root_path, this.maintainer.id, 'result')

    public slurm_id: string

    public modules: Array<string> = []

    public template: string

    registerModules(modules: Array<string>) {
        this.modules = this.modules.concat(modules)
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
        this.template = `#!/bin/bash
#SBATCH --job-name=${this.jobID}
#SBATCH --nodes=${config.num_of_node}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --cpus-per-task=${config.cpu_per_task}
#SBATCH --mem-per-cpu=${config.memory_per_cpu}
#SBATCH --time=${walltime}
#SBATCH --error=${path.join(this.remote_result_folder_path, "slurm.stdout")}
#SBATCH --output=${path.join(this.remote_result_folder_path, "slurm.stdout")}

${modules}
${cmd}`
    }

    async submit() {
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_UPLOAD', `uploading executable files`)
        await this.upload(this.maintainer.executableFolder, this.remote_executable_folder_path)
        await this.createFile(this.template, path.join(this.remote_executable_folder_path, 'job.sbatch'))

        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_MKDIR_RESULT', `creating result folder`)
        await this.mkdir(this.remote_result_folder_path)

        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT', `submitting slurm job`)
        var sbatchResult = (await this.exec(`sbatch job.sbatch`, {
            cwd: this.remote_executable_folder_path
        })).stdout

        if (sbatchResult.includes('ERROR') || sbatchResult.includes('WARN')) {
            if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_ERROR', 'cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
            throw new ConnectorError('cannot submit job ' + this.maintainer.id + ': ' + sbatchResult)
        }
        this.slurm_id = sbatchResult.split(/[ ]+/).pop().trim()
    }

    // Job id              Name             Username        Time Use S Queue          
    // ------------------- ---------------- --------------- -------- - ---------------
    // 3142249             singularity      cigi-gisolve    00:00:00 R node           
    async getStatus(mute = true) {
        try {
            var statusResult = (await this.exec(`qstat ${this.slurm_id}`, {}, mute)).stdout
            if (statusResult == null) return 'UNKNOWN'
            var r = statusResult.split(/[ |\n]+/)
            var i = r.indexOf(this.slurm_id)
            return r[i + 4]
        } catch (e) {
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SLURM_GET_STATUS_ERROR', 'cannot parse status result ' + statusResult)
            throw new ConnectorError('cannot parse status result ' + statusResult)
        }
    }

    async cancel() {
        await this.exec(`scancel ${this.slurm_id}`)
    }

    async pause() {
        await this.exec(`scontrol suspend ${this.slurm_id}`)
    }

    async resume() {
        await this.exec(`scontrol resume ${this.slurm_id}`)
    }

    async getSlurmOutput() {
        var out = await this.cat(path.join(this.remote_result_folder_path, "slurm.stdout"), {}, true)
        if (this.maintainer != null && out != null) this.maintainer.emitLog(out)
    }

    getRemoteExecutableFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_executable_folder_path, providedPath)
        else return this.remote_executable_folder_path
    }

    getRemoteDataFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_data_folder_path, providedPath)
        else return this.remote_data_folder_path
    }

    getRemoteResultFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_result_folder_path, providedPath)
        else return this.remote_result_folder_path
    }
}

export default SlurmConnector