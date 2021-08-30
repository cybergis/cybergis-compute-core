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

    async append(job: Job, taskId: string) {
        await this.connect()
        var taskIds = await this.get(job)
        if (taskId in taskIds) return
        taskIds.push(taskId)
        await this.redis.setValue(`globus_task_${job.id}`, JSON.stringify(taskIds))
    }

    async get(job: Job): Promise<string[]> {
        await this.connect()
        return JSON.parse(await this.redis.getValue(`globus_task_${job.id}`))
    }

    async remove(job: Job, taskId: string) {
        await this.connect()
        var taskIds = await this.get(job)
        if (!(taskId in taskIds)) return

        if (newTaskIds.length == 1) {
            this.redis.delValue(`globus_task_${job}`)
        }

        var newTaskIds = []
        for (var i in taskIds) {
            if (taskIds[i] != taskId) newTaskIds.push(taskIds[i])
        }
        await this.redis.setValue(`${job.id}`, JSON.stringify(taskIds))
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

    static async initTransfer(from: GlobusFolder, to: GlobusFolder, hpcConfig: hpcConfig): Promise<string> {
        var connection = await this.db.connect()
        var globusTransferRefreshTokenRepo = connection.getRepository(GlobusTransferRefreshToken)
        var g = await globusTransferRefreshTokenRepo.findOne(hpcConfig.globus.identity)

        var out = await PythonUtil.run('globus_init.py', [
            config.globus_client_id,
            g.transferRefreshToken,
            from.endpoint,
            from.path,
            to.endpoint,
            to.path,
            `${from.endpoint}:${from.path}->${to.endpoint}:${to.endpoint}`
        ], ['task_id'])

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

        var out = await PythonUtil.run(script, [
            config.globus_client_id,
            g.transferRefreshToken,
            taskId
        ], ['status'])

        return out['status']   
    }
}