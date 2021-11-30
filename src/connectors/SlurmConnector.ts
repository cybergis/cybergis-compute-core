import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm } from '../types'
import { LocalFolder, GlobusFolder, FileSystem } from '../FileSystem'
import * as path from 'path'
import GlobusUtil from '../lib/GlobusUtil'

class SlurmConnector extends BaseConnector {

    public slurm_id: string

    public modules: Array<string> = []

    public template: string

    public isContainer = false

    registerModules(modules: Array<string>) {
        this.modules = this.modules.concat(modules)
    }

    prepare(cmd: string, config: slurm) {
        config = Object.assign({
            time: '01:00:00',
            num_of_task: 1,
            cpu_per_task: 1
        }, config)

        var modules = ``
        if (config.modules) for (var i in config.modules) modules += `module load ${config.modules[i]}\n`

        // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
        this.template = `#!/bin/bash
#SBATCH --job-name=${this.jobID}
${config.num_of_node ? `#SBATCH --nodes=${config.num_of_node}` : ''}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --time=${config.time}
#SBATCH --error=${path.join(this.remote_result_folder_path, "job.stderr")}
#SBATCH --output=${path.join(this.remote_result_folder_path, "job.stdout")}
${config.cpu_per_task ? `#SBATCH --cpus-per-task=${config.cpu_per_task}` : ''}
${config.memory_per_gpu ? `#SBATCH --mem-per-gpu=${config.memory_per_gpu}` : ''}
${config.memory_per_cpu ? `#SBATCH --mem-per-cpu=${config.memory_per_cpu}` : ''}
${config.memory ? `#SBATCH --mem=${config.memory}` : ''}
${config.gpus ? `#SBATCH --gpus=${config.gpus}` : ''}
${config.gpus_per_node ? `#SBATCH --gpus-per-node=${config.gpus_per_node}` : ''}
${config.gpus_per_socket ? `#SBATCH --gpus-per-socket=${config.gpus_per_socket}` : ''}
${config.gpus_per_task ? `#SBATCH --gpus-per-task=${config.gpus_per_task}` : ''}
${config.partition ? `#SBATCH --partition=${config.partition}` : ''}
${this.getSBatchTagsFromArray('mail-type', config.mail_type)}
${this.getSBatchTagsFromArray('mail-user', config.mail_user)}
${this.config.init_sbatch_options ? this.config.init_sbatch_options.join('\n') : ''}
module purge
${this.config.init_sbatch_script ? this.config.init_sbatch_script.join('\n') : ''}
${modules}
${cmd}`
    }

    async submit() {
        // executable folder
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_UPLOAD', `uploading files`)
        await this.upload(this.maintainer.executableFolder, this.remote_executable_folder_path, true)
        // job.sbatch
        await this.createFile(this.template, path.join(this.remote_executable_folder_path, 'job.sbatch'), {}, true)
        // job.json
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
        await this.createFile(jobJSON, path.join(this.remote_executable_folder_path, 'job.json'))

        // data folder
        if (this.maintainer.dataFolder) {
            if (this.maintainer.dataFolder instanceof LocalFolder) {
                await this.upload(this.maintainer.dataFolder, this.remote_data_folder_path, true)
            }

            if (this.maintainer.dataFolder instanceof GlobusFolder) {
                var to = FileSystem.getGlobusFolderByHPCConfig(this.config, `${this.jobID}/data`)

                try {
                    if (this.maintainer != null) this.maintainer.emitEvent('GLOBUS_TRANSFER_INIT', `initializing Globus job`)
                    var taskId = await GlobusUtil.initTransfer(this.maintainer.dataFolder, to, this.config, this.jobID)
                    if (this.maintainer != null) this.maintainer.emitEvent('GLOBUS_TRANSFER_INIT_SUCCESS', `initialized Globus job with task ID ${taskId}`)
                } catch (e) {
                    if (this.maintainer != null) this.maintainer.emitEvent('GLOBUS_TRANSFER_INIT_FAILED', `cannot initialize Globus job`)
                    throw new Error(e)
                }

                var monitorTransfer = async (): Promise<string> => {
                    try {
                        var status = await GlobusUtil.monitorTransfer(taskId, this.config)
                        return status
                    } catch (e) { 
                        return await monitorTransfer() // recursive
                    }
                }

                var status = await monitorTransfer()
                if (status === 'FAILED') {
                    if (this.maintainer != null) this.maintainer.emitEvent('GLOBUS_TRANSFER_FAILED', `Globus job with task ID ${taskId} failed`)
                    throw new Error('Globus transfer failed')
                } else {
                    if (this.maintainer != null) this.maintainer.emitEvent('GLOBUS_TRANSFER_COMPLETE', `Globus job with task ID ${taskId} is complete`)
                }
            }
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

        var failed = false
        if (!sbatchResult.stdout || sbatchResult.stderr) failed = true
        else if (sbatchResult.stdout.includes('ERROR') || sbatchResult.stdout.includes('WARN')) failed = true

        if (failed) {
            if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_ERROR', 'cannot submit job ' + this.maintainer.id + ': ' + JSON.stringify(sbatchResult))
            throw new ConnectorError('cannot submit job ' + this.maintainer.id + ': ' + JSON.stringify(sbatchResult))
        }

        this.slurm_id = sbatchResult.stdout.split(/[ ]+/).pop().trim()
        if (this.maintainer != null) this.maintainer.emitEvent('SLURM_SUBMIT_SUCCESS', `slurm job submitted with slurm job id ${this.slurm_id}`)
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

    private getSBatchTagsFromArray(tag: string, vals: string[]) {
        if (!vals) return ``
        var out = ``
        for (var i in vals) out += `#SBATCH --${tag}=${vals[i]}\n`
        return out
    }

    getContainerExecutableFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/job/executable`, providedPath)
        else return `/job/executable` 
    }

    getContainerDataFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/job/data`, providedPath)
        else return `/job/data` 
    }

    getContainerResultFolderPath(providedPath: string = null) {
        if (providedPath) return path.join(`/job/result`, providedPath)
        else return `/job/result`
    }
}

export default SlurmConnector