import { slurm_integer_storage_unit_config, slurm_integer_time_unit_config, slurmInputRules, slurm_integer_configs } from '../types'
import { Job } from "../models/Job"
import { hpcConfigMap, jupyterGlobusMap, maintainerConfigMap } from "../../configs/config"
import { GitFolder, FileSystem } from '../FileSystem'
import { config } from "../../configs/config"
import path = require('path')
import DB from '../DB'
const redis = require('redis')
const { promisify } = require("util")

export class ResultFolderContentManager {
    private redis = {
        getValue: null,
        setValue: null,
        delValue: null,
    }

    private isConnected = false

    async put(jobId: string, contents: string[]) {
        await this.connect()
        await this.redis.setValue(`job_result_folder_content${jobId}`, JSON.stringify(contents))
    }

    async get(jobId: string): Promise<string> {
        await this.connect()
        var out = await this.redis.getValue(`job_result_folder_content${jobId}`)
        return out ? out : null
    }

    async remove(jobId: string) {
        await this.connect()
        var out = await this.get(jobId)
        if (!out) return
        this.redis.delValue(`job_result_folder_content${jobId}`)
    }

    private async connect() {
        if (this.isConnected) return

        var client = new redis.createClient({
            host: config.redis.host,
            port: config.redis.port
        })

        if (config.redis.password != null && config.redis.password != undefined) {
            var redisAuth = promisify(client.auth).bind(client)
            await redisAuth(config.redis.password)
        }

        this.redis.getValue = promisify(client.get).bind(client)
        this.redis.setValue = promisify(client.set).bind(client)
        this.redis.delValue = promisify(client.del).bind(client)
        this.isConnected = true
    }
}

export default class JobUtil {
    static validateParam(job: Job, paramRules: {[keys: string]: any}) {
        for (var i in paramRules) {
            if (!job.param[i]) {
                throw new Error(`job missing input param ${i}`)
            }
        }
    }

    static async getUserSlurmUsage(userId: string, format = false) {
        const db = new DB()
        const connection = await db.connect()
        const jobs = await connection.getRepository(Job).find({ userId: userId })

        var userSlurmUsage = {
            nodes: 0,
            cpus: 0,
            cpuTime: 0,
            memory: 0,
            memoryUsage: 0,
            walltime: 0
        }

        for (var i in jobs) {
            const job = jobs[i]
            if (job.nodes) userSlurmUsage.nodes += job.nodes
            if (job.cpus) userSlurmUsage.cpus += job.cpus
            if (job.cpuTime) userSlurmUsage.cpuTime += job.cpuTime
            if (job.memory) userSlurmUsage.memory += job.memory
            if (job.memoryUsage) userSlurmUsage.memoryUsage += job.memoryUsage
            if (job.walltime) userSlurmUsage.walltime += job.walltime
        }  


        if (format) {
            return {
                nodes: userSlurmUsage.nodes,
                cpus: userSlurmUsage.cpus,
                cpuTime: this.secondsToTimeDelta(userSlurmUsage.cpuTime),
                memory: this.kbToStorageUnit(userSlurmUsage.memory),
                memoryUsage: this.kbToStorageUnit(userSlurmUsage.memoryUsage),
                walltime: this.secondsToTimeDelta(userSlurmUsage.walltime)
            }
        } else {
            return {
                nodes: userSlurmUsage.nodes,
                cpus: userSlurmUsage.cpus,
                cpuTime: userSlurmUsage.cpuTime,
                memory: userSlurmUsage.memory,
                memoryUsage: userSlurmUsage.memoryUsage,
                walltime: userSlurmUsage.walltime
            }
        }
    }

    static async validateJob(job: Job, jupyterHost: string, username: string) {
        // validate input data
        if (job.dataFolder) {
            var jupyterGlobus = jupyterGlobusMap[jupyterHost]
            if (jupyterGlobus) {
                var validPath = path.join(jupyterGlobus.root_path, username)
                if (job.dataFolder.includes(jupyterGlobus.root_path) && !job.dataFolder.includes(validPath)) {
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
            if (!slurmCeiling[i]) slurmCeiling[i] = globalInputCap[i]
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
            return this.storageUnitToKB(a) < this.storageUnitToKB(b)
        }
        if (slurm_integer_time_unit_config.includes(i)) {
            return this.timeToSeconds(a) < this.timeToSeconds(b)
        }
        return a < b
    }

    static storageUnitToKB(i: string) {
        i = i.toLowerCase().replace(/b/gi, '')
        if (i.includes('p')) {
            return parseInt(i.replace('p', '').trim()) * 1024 * 1024 * 1024
        }
        if (i.includes('g')) {
            return parseInt(i.replace('g', '').trim()) * 1024 * 1024
        }
        if (i.includes('m')) {
            return parseInt(i.replace('m', '').trim()) * 1024
        }
    }

    static kbToStorageUnit(i: number) {
        var units = ['kb', 'mb', 'gb', 'tb', 'pb', 'eb'].reverse()
        while (units.length > 0) {
            var unit = units.pop()
            i = i / 1024
            if (i < 1024) return `${i}${unit}`
        }
        return `${i}pb`
    }

    static secondsToTimeDelta(i: number) {
        var days = Math.floor(i / (60 * 60 * 24))
        var hours = Math.floor(i / (60 * 60))
        var minutes = Math.floor(i / 60)
        //
        var format = (j) => {
            if (j == 0) return '00'
            else if (j < 10) return `0${j}`
            else return `${j}`
        }
        return `${format(days)}:${format(hours)}:${format(minutes)}`
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