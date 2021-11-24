import { GlobusTransferRefreshToken } from '../models/GlobusTransferRefreshToken'
import { GlobusFolder } from "../FileSystem"
import PythonUtil from "./PythonUtil"
import { config } from "../../configs/config"
import { hpcConfig } from '../types'
import DB from "../DB"
import { Job } from '../models/Job'
const redis = require('redis')
const { promisify } = require("util")

export class JobGlobusTaskListManager {
    private redis = {
        getValue: null,
        setValue: null,
        delValue: null,
    }

    private isConnected = false

    async put(job: Job, taskId: string) {
        await this.connect()
        await this.redis.setValue(`globus_task_${job.id}`, taskId)
    }

    async get(job: Job): Promise<string> {
        await this.connect()
        var out = await this.redis.getValue(`globus_task_${job.id}`)
        return out ? out : null
    }

    async remove(job: Job, taskId: string) {
        await this.connect()
        var taskId = await this.get(job)
        if (!taskId) return
        this.redis.delValue(`globus_task_${job}`)
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

export default class GlobusUtil {
    static db = new DB()

    static async initTransfer(from: GlobusFolder, to: GlobusFolder, hpcConfig: hpcConfig, label: string = ''): Promise<string> {
        var connection = await this.db.connect()
        var globusTransferRefreshTokenRepo = connection.getRepository(GlobusTransferRefreshToken)
        var g = await globusTransferRefreshTokenRepo.findOne(hpcConfig.globus.identity)

        try {
            var out = await PythonUtil.run('globus_init.py', [
                config.globus_client_id,
                g.transferRefreshToken,
                from.endpoint,
                from.path,
                to.endpoint,
                to.path,
                `${label}_${Math.floor(Math.random() * 1000)}`
            ], ['task_id'])
        } catch (e) {
            throw new Error(`Globus query status failed with error: ${e}`)
        }

        if (!out['task_id']) throw new Error(`cannot initialize Globus job: ${out['error']}`)
        return out['task_id']
    }

    static async monitorTransfer(taskId: string, hpcConfig: hpcConfig): Promise<string> {
        return await this._queryStatus(taskId, hpcConfig, 'globus_monitor.py')
    }

    static async queryTransferStatus(taskId: string, hpcConfig: hpcConfig): Promise<string> {
        return await this._queryStatus(taskId, hpcConfig, 'globus_query_status.py')
    }

    static async _queryStatus(taskId: string, hpcConfig: hpcConfig, script: string) {
        var connection = await this.db.connect()
        var globusTransferRefreshTokenRepo = connection.getRepository(GlobusTransferRefreshToken)
        var g = await globusTransferRefreshTokenRepo.findOne(hpcConfig.globus.identity)

        try {
            var out = await PythonUtil.run(script, [
                config.globus_client_id,
                g.transferRefreshToken,
                taskId
            ], ['status'])
        } catch (e) {
            throw new Error(`Globus query status failed with error: ${e}`)
        }

        return out['status']   
    }
}