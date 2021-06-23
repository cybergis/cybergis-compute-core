import JAT from './JAT'
import Helper from './Helper'
import DB from './DB'
import { FindOneOptions } from 'typeorm'
import { credential } from './types'
import { Job } from './models/Job'
import { config, hpcConfigMap } from '../configs/config'
const NodeSSH = require('node-ssh')
const redis = require('redis')
const { promisify } = require("util")

class CredentialManager {
    private redis = {
        getValue: null,
        setValue: null,
        delValue: null,
    }

    private isConnected = false

    async add(key: string, cred: credential) {
        await this.connect()
        await this.redis.setValue(key, JSON.stringify(cred))
    }

    async get(key: string): Promise<credential> {
        await this.connect()
        return JSON.parse(await this.redis.getValue(key))
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

class Guard {
    private jat = new JAT()

    private authenticatedAccessTokenCache: {[keys: string]: {[keys: string]: Job}} = {}

    private credentialManager = new CredentialManager()

    private ssh = new NodeSSH()

    private db = new DB()

    async validatePrivateAccount(hpcName: string, user: string, password: string): Promise<void> {
        this.clearCache()
        var hpc = hpcConfigMap[hpcName]

        try {
            await this.ssh.connect({
                host: hpc.ip,
                port: hpc.port,
                user: user,
                password: password
            })
            await this.ssh.dispose()
        } catch (e) {
            throw new Error(`unable to check credentials with ${hpcName}`)
        }
    }

    async validateCommunityAccount(): Promise<void> {
        this.clearCache()
        // TBD
    }

    async issueJobSecretToken(): Promise<string> {
        var connection = await this.db.connect()
        var jobRepo = connection.getRepository(Job)

        var secretToken = Helper.randomStr(45)
        while (await jobRepo.findOne({ secretToken: secretToken })) {
            secretToken = Helper.randomStr(45)
        }
        return secretToken
    }

    async registerCredential(user: string, password: string): Promise<string> {
        var credentialId = this.generateID()
        this.credentialManager.add(credentialId, {
            id: credentialId,
            user: user,
            password: password
        })
        return credentialId
    }

    async validateJobAccessToken(accessToken: string, withRelations: boolean = false): Promise<Job> {
        this.clearCache()

        var rawAccessToken = this.jat.parseAccessToken(accessToken)
        var date = this.jat.getDate()
        if (rawAccessToken.payload.decoded.date != date) throw new Error('invalid accessToken provided')
    
        if (!this.authenticatedAccessTokenCache[date]) {
            this.authenticatedAccessTokenCache[date] = {}
        } else {
            var cacheJob: Job = this.authenticatedAccessTokenCache[date][rawAccessToken.hash]
            if (cacheJob != undefined) return cacheJob
        }

        var connection = await this.db.connect()
        var jobRepo = connection.getRepository(Job)
        var relations: FindOneOptions = withRelations ? {
            relations: ['logs', 'events']
        } : {}

        var job = await jobRepo.findOne(rawAccessToken.id, relations)
        if (!job) throw new Error('invalid accessToken provided')

        var hash = this.jat.init(rawAccessToken.alg, job.id, job.secretToken).hash(rawAccessToken.payload.encoded)
        if (hash != rawAccessToken.hash) throw new Error('invalid accessToken provided')

        this.authenticatedAccessTokenCache[date][rawAccessToken.hash] = job
        return job
    }

    updateJobAccessTokenCache(accessToken: string, job: Job) {
        var date = this.jat.getDate()
        var rawAccessToken = this.jat.parseAccessToken(accessToken)
        this.authenticatedAccessTokenCache[date][rawAccessToken.hash] = job
    }

    generateID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(5)
    }

    private async clearCache() {
        var date = this.jat.getDate()
        for (var i in this.authenticatedAccessTokenCache) {
            if (parseInt(i) < date) {
                delete this.authenticatedAccessTokenCache[i]
            }
        }
    }
}

export default Guard
export { CredentialManager, Guard }