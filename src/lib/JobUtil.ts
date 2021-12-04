import { slurm_integer_storage_unit_config, slurm_integer_time_unit_config, slurmInputRules, slurm_integer_configs } from '../types'
import { Job } from "../models/Job"
import { hpcConfigMap, jupyterGlobusMap, maintainerConfigMap } from "../../configs/config"
import { GitFolder, FileSystem } from '../FileSystem'
import path = require('path')

export default class JobUtil {
    static validateParam(job: Job, paramRules: {[keys: string]: any}) {
        for (var i in paramRules) {
            if (!job.param[i]) {
                throw new Error(`job missing input param ${i}`)
            }
        }
    }

    static async validateJob(job: Job, jupyterHost: string, username: string) {
        // validate input data
        if (job.dataFolder) {
            var jupyterGlobus = jupyterGlobusMap[jupyterHost]
            if (jupyterGlobus) {
                var validPath = path.join(jupyterGlobus.root_path, username)
                if (!job.dataFolder.includes(validPath)) {
                    throw new Error('invalid dataFolder path')
                }
            }
        }

        // create slurm config rules
        var providedSlurmInputRules: slurmInputRules = {}
        var providedParamRules: {[keys: string]: any} = {}
        var requireUploadData = false
        const maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            var u = job.executableFolder.split('://')
            if (u[0] === 'git') {
                var f = new GitFolder(u[1])
                var m = await f.getExecutableManifest()
                if (m.slurm_input_rules) {
                    providedSlurmInputRules = m.slurm_input_rules
                }
                if (m.param_rules) {
                    providedParamRules = m.param_rules
                }
                if (m.require_upload_data) {
                    requireUploadData = m.require_upload_data
                }
            }
        }

        if (requireUploadData && !job.dataFolder) {
            throw new Error(`job missing upload data`)
        }

        if (maintainerConfig.executable_folder.from_user) {
            if (job.executableFolder == undefined) throw new Error('no file provided')
            var file = FileSystem.getFolderByURL(job.executableFolder, maintainerConfig.executable_folder.allowed_protocol)
            file.validate()
        }

        JobUtil.validateSlurmConfig(job, providedSlurmInputRules)
        JobUtil.validateParam(job, providedParamRules)
    }

    static validateSlurmConfig(job: Job, slurmInputRules: slurmInputRules) {
        var slurmCeiling = {}
        var globalInputCap = hpcConfigMap[job.hpc].slurm_global_cap
        if (!globalInputCap) globalInputCap = {}
        slurmInputRules = Object.assign(hpcConfigMap[job.hpc].slurm_input_rules, slurmInputRules)

        var defaultSlurmCeiling = {
            num_of_node: 50,
            num_of_task: 50,
            cpu_per_task: 50,
            memory_per_cpu: '10G',
            memory_per_gpu: '10G',
            memory: '50G',
            gpus: 20,
            gpus_per_node: 20,
            gpus_per_socket: 20,
            gpus_per_task: 20,
            time: '10:00:00'
        }

        for (var i in slurmInputRules) {
            if (!slurmInputRules[i].max) continue
            if (slurm_integer_storage_unit_config.includes(i)) {
                slurmCeiling[i] = slurmInputRules[i].max + slurmInputRules[i].unit
            } else if (slurm_integer_time_unit_config.includes(i)) {
                var val = slurmInputRules[i].max
                var unit = slurmInputRules[i].unit
                var sec = JobUtil.unitTimeToSeconds(val, unit)
                slurmCeiling[i] = JobUtil.secondsToTime(sec)
            } else if (slurm_integer_configs.includes(i)) {
                slurmCeiling[i] = slurmInputRules[i].max
            }
        }

        for (var i in globalInputCap) {
            if (!globalInputCap[i]) slurmCeiling[i] = globalInputCap[i]
            else if (this.compareSlurmConfig(i, globalInputCap[i], slurmCeiling[i])) {
                slurmCeiling[i] = globalInputCap[i]
            }
        }

        for (var i in defaultSlurmCeiling) {
            if (!slurmCeiling[i]) {
                slurmCeiling[i] = defaultSlurmCeiling[i]
                continue
            }
        }

        for (var i in slurmCeiling) {
            if (!job.slurm[i]) continue
            if (this.compareSlurmConfig(i, slurmCeiling[i], job.slurm[i])) {
                throw new Error(`slurm config ${i} exceeds the threshold of ${slurmCeiling[i]} (current value ${job.slurm[i]})`)
            }
        }
    }

    static compareSlurmConfig(i, a, b) {
        if (slurm_integer_storage_unit_config.includes(i)) {
            return this.storageUnitToSize(a) < this.storageUnitToSize(b)
        }
        if (slurm_integer_time_unit_config.includes(i)) {
            return this.timeToSeconds(a) < this.timeToSeconds(b)
        }
        return a < b
    }

    static storageUnitToSize(i: string) {
        i = i.toLowerCase()
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

    static unitTimeToSeconds(time: number, unit: string) {
        if (unit == 'Minutes') return time * 60
        if (unit == 'Hours') return time * 60 * 60
        if (unit == 'Days') return time * 60 * 60 * 24
        return 0
    }

    static secondsToTime(seconds: number) {
        var days = Math.floor(seconds / (60 * 60 * 24))
        var hours = Math.floor(seconds / (60 * 60) - (days * 24))
        var minutes = Math.floor(seconds / 60 -  (days * 60 * 24) - (hours * 60))

        var d = days < 10 ? `0${days}` : `${days}`
        var h = hours < 10 ? `0${hours}` : `${hours}`
        var m = minutes < 10 ? `0${minutes}` : `${minutes}`

        if (days == 0) {
            if (hours == 0) {
                return `${m}:00`
            } else {
                return `${h}:${m}:00`
            }
        } else {
            return `${d}-${h}:${m}:00`
        }
    }

    static timeToSeconds(raw: string) {
        var i = raw.split(':')
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
}