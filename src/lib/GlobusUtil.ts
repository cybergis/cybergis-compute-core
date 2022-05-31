import { GlobusTransferRefreshToken } from '../models/GlobusTransferRefreshToken'
import PythonUtil from "./PythonUtil"
import { config } from "../../configs/config"
import { GlobusFile, hpcConfig } from '../types'
import DB from "../DB"
const redis = require('redis')
const { promisify } = require("util")

export class GlobusTaskListManager {
    /**
     * Class for managing globus tasks
     */
    private redis = {
        getValue: null,
        setValue: null,
        delValue: null,
    }

    private isConnected = false

    /**
     * Assigns label to taskId
     * 
     * @param{string} label - input label
     * @param{string} taskId - setValue id
     */
    async put(label: string, taskId: string) {
        await this.connect()
        await this.redis.setValue(`globus_task_${label}`, taskId)
    }

    /**
     * Get taskId for specified label
     * 
     * @param{string} label - input label
     * @return{string} out - redis output
     */
    async get(label: string): Promise<string> {
        await this.connect()
        var out = await this.redis.getValue(`globus_task_${label}`)
        return out ? out : null
    }

    /**
     * removes taskId for specified label
     * 
     * @param{string} label - input label
     */
    async remove(label: string) {
        await this.connect()
        var out = await this.get(label)
        if (!out) return
        this.redis.delValue(`globus_task_${label}`)
    }

    /**
     * @async
     * Connect to globus through redis
     */
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
    /**
     * Class for accessing Globus commands
     */
    static db = new DB()

    /**
     * @static
     * Initializes globus job
     * @param{GlobusFile} from - from transfer folder
     * @param{GlobusFile} to - to transfer folder
     * @param{hpcConfig} hpcConfig - hpcConfiguration
     * @param{string} label - task label
     * @throw{Error} - Thrown if globus query status fails
     * @return{string} - taskId
     */
    static async initTransfer(from: GlobusFile, to: GlobusFile, hpcConfig: hpcConfig, label: string = ''): Promise<string> {
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

    /**
     * @static
     * @async
     * Returns output of querying 'globus_monitor.py'
     * @param{string} taskId - taskId of transfer
     * @param{hpcConfig} hpcConfig - hpcConfiguration
     * @return{Promise<string>} - queryStatus string
     */
    static async monitorTransfer(taskId: string, hpcConfig: hpcConfig): Promise<string> {
        return await this._queryStatus(taskId, hpcConfig, 'globus_monitor.py')
    }

    /**
     * @static
     * @async
     * Returns output of querying 'globus_query_status.py'
     * @param{string} taskId - taskId of transfer
     * @param{hpcConfig} hpcConfig - hpcConfiguration
     * @return{Promise<string>} - queryStatus string
     */
    static async queryTransferStatus(taskId: string, hpcConfig: hpcConfig): Promise<string> {
        return await this._queryStatus(taskId, hpcConfig, 'globus_query_status.py')
    }

    
    /**
     * @static
     * @async
     * Implements the specified globus query
     * @param{string} taskId - taskId of transfer
     * @param{hpcConfig} hpcConfig - hpcConfiguration
     * @param{string} script - query string
     * @throw{Error} - thrown when Globus query status fails
     * @return{string} - queryStatus string
     */
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