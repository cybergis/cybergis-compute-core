import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm } from '../types'
import * as path from 'path'

class SlurmConnector extends BaseConnector {

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
#SBATCH --error=${path.join(this.remote_result_folder_path, "job.stderr")}
#SBATCH --output=${path.join(this.remote_result_folder_path, "job.stdout")}
${config.gpus ? '#SBATCH --gres=gpu:' + config.gpus : ''}
${config.partition ? '#SBATCH --partition=' + config.partition : ''}

${modules}
${cmd}`
    }

    async submit() {
        // executable folder
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_UPLOAD', `uploading files`)
        await this.upload(this.maintainer.executableFolder, this.remote_executable_folder_path, true)
        await this.createFile(this.template, path.join(this.remote_executable_folder_path, 'job.sbatch'), {}, true)
        await this.createFile({
            jobId: this.maintainer.job.id,
            userId: this.maintainer.job.userId,
            maintainer: this.maintainer.job.maintainer,
            hpc: this.maintainer.job.hpc,
            param: this.maintainer.job.param,
            env: this.maintainer.job.env,
            executableFolder: this.getRemoteExecutableFolderPath(),
            dataFolder: this.getRemoteDataFolderPath(),
            resultFolder: this.getRemoteResultFolderPath()
        }, path.join(this.remote_executable_folder_path, 'job.json'))

        // data folder
        if (this.maintainer.dataFolder) {
            await this.upload(this.maintainer.dataFolder, this.remote_data_folder_path, true)
        } else {
            await this.mkdir(this.remote_data_folder_path, {}, true)
        }

        // result folder
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_MKDIR_RESULT', `creating result folder`)
        await this.mkdir(this.remote_result_folder_path, {}, true)

        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT', `submitting slurm job`)
        var sbatchResult = (await this.exec(`sbatch job.sbatch`, {
            cwd: this.remote_executable_folder_path
        }, true, true))

        if (sbatchResult.stdout.includes('ERROR') || sbatchResult.stdout.includes('WARN') || sbatchResult.stderr) {
            if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_ERROR', 'cannot submit job ' + this.maintainer.id + ': ' + JSON.stringify(sbatchResult))
            throw new ConnectorError('cannot submit job ' + this.maintainer.id + ': ' + JSON.stringify(sbatchResult))
        }
        this.slurm_id = sbatchResult.stdout.split(/[ ]+/).pop().trim()
    }

    // qstat:
    // Job id              Name             Username        Time Use S Queue          
    // ------------------- ---------------- --------------- -------- - ---------------
    // 3142249             singularity      cigi-gisolve    00:00:00 R node      
    //
    // squeue: https://slurm.schedmd.com/squeue.html
    // ['JOBID', 'PARTITION', 'NAME', 'USER', 'ST', 'TIME', 'NODES', 'NODELIST(REASON)']
    // ['3142135', 'node', 'singular', 'cigi-gis', 'R', '0:11', '1', 'keeling-b08']
    async getStatus() {
        try {
            var squeueResult = await this.exec(`squeue --job ${this.slurm_id}`, {}, true, true)

            if (!squeueResult.stderr && squeueResult.stdout) {
                console.log(squeueResult)
                var r = squeueResult.stdout.split(/[ |\n]+/)
                var i = r.indexOf(this.slurm_id)
                return i >= 0 ? r[i + 4] : 'UNKNOWN'
            }

            var qstatResult = await this.exec(`qstat ${this.slurm_id}`, {}, true, true)

            if (qstatResult.stdout) {
                var r = qstatResult.stdout.split(/[ |\n]+/)
                var i = r.indexOf(this.slurm_id)
                return i >= 0 ? r[i + 4] : 'UNKNOWN'
            }

            return 'RETRY'
        } catch (e) {
            return 'RETRY'
        }
    }

    async cancel() {
        await this.exec(`scancel ${this.slurm_id}`, {}, true)
    }

    async pause() {
        await this.exec(`scontrol suspend ${this.slurm_id}`, {}, true)
    }

    async resume() {
        await this.exec(`scontrol resume ${this.slurm_id}`, {}, true)
    }

    async getSlurmStdout() {
        var out = await this.cat(path.join(this.remote_result_folder_path, "job.stdout"), {})
        if (this.maintainer && out) this.maintainer.emitLog(out)
    }

    async getSlurmStderr() {
        var out = await this.cat(path.join(this.remote_result_folder_path, "job.stderr"), {})
        if (this.maintainer && out) this.maintainer.emitLog(out)
    }
}

export default SlurmConnector