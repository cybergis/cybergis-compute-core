import { ConnectorError } from '../errors'
import BaseConnector from './BaseConnector'
import { slurm, slurmCeiling } from '../types'
import { LocalFolder } from '../FileSystem'
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
            walltime: '00:10:00',
            num_of_node: 1,
            num_of_task: 1,
            cpu_per_task: 1,
        }, config)

        var modules = ''
        for (var module in this.modules) modules += `module load ${module}\n`

        // https://researchcomputing.princeton.edu/support/knowledge-base/slurm
        this.template = `#!/bin/bash
#SBATCH --job-name=${this.jobID}
#SBATCH --nodes=${config.num_of_node}
#SBATCH --ntasks=${config.num_of_task}
#SBATCH --cpus-per-task=${config.cpu_per_task}
#SBATCH --time=${config.walltime}
#SBATCH --error=${path.join(this.remote_result_folder_path, "job.stderr")}
#SBATCH --output=${path.join(this.remote_result_folder_path, "job.stdout")}
${config.memory_per_gpu ? `#SBATCH --mem-per-gpu=${config.memory_per_gpu}` : ''}
${config.memory_per_cpu ? `#SBATCH --mem-per-cpu=${config.memory_per_cpu}` : ''}
${config.memory ? `#SBATCH --mem=${config.memory}` : ''}
${config.gpus ? `#SBATCH --gpus=${config.gpus}` : ''}
${config.gpus_per_node ? `#SBATCH --gpus-per-node=${config.gpus_per_node}` : ''}
${config.gpus_per_socket ? `#SBATCH --gpus-per-socket=${config.gpus_per_socket}` : ''}
${config.gpus_per_task ? `#SBATCH --gpus-per-task=${config.gpus_per_task}` : ''}
${config.partition ? `#SBATCH --partition= ${config.partition}` : ''}
${this.getSBatchTagsFromArray('mail-type', config.mail_type)}
${this.getSBatchTagsFromArray('mail-user', config.mail_user)}

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
            executable_folder: this.getRemoteExecutableFolderPath(),
            data_folder: this.getRemoteDataFolderPath(),
            result_folder: this.getRemoteResultFolderPath()
        }
        await this.createFile(jobJSON, path.join(this.remote_executable_folder_path, 'job.json'))
        // job.env
        var jobENV = ''
        for (var key in jobJSON) {
            var structuredKeys = ['hpc', 'param', 'env']
            if (structuredKeys.includes(key)) {
                for (var i in jobJSON[key]) {
                    jobENV += `${key}_${i}="${jobJSON[key][i]}"\n`
                }
            } else {
                jobENV += `${key}="${jobJSON[key]}"\n`
            }
        }
        await this.createFile(jobENV, path.join(this.remote_executable_folder_path, 'job.env'), {}, true)

        // data folder
        if (this.maintainer.dataFolder) {
            if (this.maintainer.dataFolder instanceof LocalFolder) {
                await this.upload(this.maintainer.dataFolder, this.remote_data_folder_path, true)
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

    static storageUnitToSize(i: string) {
        if (i.includes('g')) {
            return parseInt(i.replace('g', '')) * 1000 * 1000 * 1000
        }
        if (i.includes('m')) {
            return parseInt(i.replace('g', '')) * 1000 * 1000
        }
        if (i.includes('k')) {
            return parseInt(i.replace('k', '')) * 1000
        }
    }

    static storageIsSmaller(a: string, b: string) {
        a = a.toLowerCase()
        b = b.toLowerCase()
        var i = this.storageUnitToSize(a)
        var j = this.storageUnitToSize(b)
        return i < j
    }

    static timeToSeconds(i: string[]) {
        if (i.length == 1) {
            var j = i[0].split('-')
            if (j.length == 1) {
                // minutes
                return parseInt(i[0]) * 60
            } else {
                // days-hours
                return parseInt(j[0]) * 60 * 60 * 24 + parseInt(j[0]) * 60 * 60
            }
        } else if (i.length == 2) {
            var j = i[0].split('-')
            if (j.length == 2) {
                // days-hours:minutes
                return parseInt(j[0]) * 60 * 60 * 24 + parseInt(j[1]) * 60 * 60 + parseInt(i[1]) * 60
            } else {
                // minutes:seconds
                return parseInt(i[0]) * 60 + parseInt(i[0])
            }
        } else if (i.length == 3) {
            var j = i[0].split('-')
            if (j.length == 2) {
                // days-hours:minutes:seconds
                return parseInt(j[0]) * 60 * 60 * 24 + parseInt(j[1]) * 60 * 60 + parseInt(i[1]) * 60 + parseInt(i[2])
            } else {
                // hours:minutes:seconds
                return parseInt(i[0]) * 60 * 60 + parseInt(i[1]) * 60 + parseInt(i[2])
            }
        }
        return Infinity
    }

    static timeIsSmaller(a: string, b: string) {
        var a_bar = a.split(':')
        var b_bar = b.split(':')
        return this.timeToSeconds(a_bar) < this.timeToSeconds(b_bar)
    }

    static validateSlurmConfig(config: slurm, providedSlurmCeiling: slurmCeiling) {
        var defaultSlurmCeiling: slurmCeiling = {
            num_of_node: 50,
            num_of_task: 50,
            cpu_per_task: 50,
            gpus: 50,
            memory_per_cpu: '10G',
            memory_per_gpu: '10G',
            memory: '50G',
            walltime: '10:00:00'
        }

        var storageKey = ['memory_per_cpu', 'memory_per_gpu', 'memory']

        var timeKey = ['walltime']

        var slurmCeiling = {}

        for (var i in defaultSlurmCeiling) {
            slurmCeiling[i] = defaultSlurmCeiling[i]
            if (!providedSlurmCeiling[i]) continue

            if (storageKey.includes(i)) {
                if (this.storageIsSmaller(providedSlurmCeiling[i], defaultSlurmCeiling[i])) {
                    slurmCeiling[i] = providedSlurmCeiling[i]
                }
            } else if (timeKey.includes(i)) {
                if (this.timeIsSmaller(providedSlurmCeiling[i], defaultSlurmCeiling[i])) {
                    slurmCeiling[i] = providedSlurmCeiling[i]
                }
            } else {
                if (providedSlurmCeiling[i] < defaultSlurmCeiling[i]) {
                    slurmCeiling[i] = providedSlurmCeiling[i]
                }
            }
        }

        for (var i in slurmCeiling) {
            if (!config[i]) continue

            if (storageKey.includes(i)) {
                if (this.storageIsSmaller(slurmCeiling[i], config[i])) {
                    throw new Error(`slurm config ${i} exceeds the threshold of ${slurmCeiling[i]} (current value ${config[i]})`)
                }
            } else if (timeKey.includes(i)) {
                if (this.timeIsSmaller(slurmCeiling[i], config[i])) {
                    throw new Error(`slurm config ${i} exceeds the threshold of ${slurmCeiling[i]} (current value ${config[i]})`)
                }
            } else {
                if (slurmCeiling[i] < config[i]) {
                    throw new Error(`slurm config ${i} exceeds the threshold of ${slurmCeiling[i]} (current value ${config[i]})`)
                }
            }
        }
    }
}

export default SlurmConnector