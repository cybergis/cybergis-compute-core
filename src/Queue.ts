import { Job } from './models/Job'
import { config } from '../configs/config'
import DB from './DB'
import { CredentialManager } from './Guard'
import { promisify } from 'util'
const redis = require('redis')

class Queue {
    private name

    private redis = {
        push: null,
        shift: null,
        peak: null,
        length: null
    }

    private isConnected = false

    private db = new DB()

    private credentialManager = new CredentialManager()

    constructor(name: string) {
        this.name = name
    }

    async push(item: Job) {
        await this.connect()
        await this.redis.push([this.name, item.id])
    }

    async shift(): Promise<Job> {
        await this.connect()
        var jobId = await this.redis.shift(this.name)
        return this.getJobById(jobId)
    }

    async isEmpty(): Promise<boolean> {
        await this.connect()
        return await this.redis.length(this.name) === 0
    }

    async peak(): Promise<Job> {
        await this.connect()
        if (await this.isEmpty()) return undefined
        var jobId = await this.redis.peak(this.name, 0, 0)
        return this.getJobById(jobId)
    }

    async length(): Promise<number> {
        await this.connect()
        return await this.redis.length(this.name)
    }

    private async connect() {
        if (!this.isConnected) {
            var client = new redis.createClient({
                host: config.redis.host,
                port: config.redis.port,
            })

            if (config.redis.password != null && config.redis.password != undefined) {
                var redisAuth = promisify(client.auth).bind(client)
                await redisAuth(config.redis.password)
            }

            this.redis.push = promisify(client.rpush).bind(client)
            this.redis.shift = promisify(client.lpop).bind(client)
            this.redis.peak = promisify(client.lrange).bind(client)
            this.redis.length = promisify(client.llen).bind(client)
            this.isConnected = true
        }
    }

    private async getJobById(id: string): Promise<Job> {
        var connection = await this.db.connect()
        var jobRepo = connection.getRepository(Job)
        var job = await jobRepo.findOne(id)

        if (job.credentialId) {
            job.credential = await this.credentialManager.get(job.credentialId)
        }

        return job
    }
}

export default Queue