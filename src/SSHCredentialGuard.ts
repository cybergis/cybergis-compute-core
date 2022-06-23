import Helper from './Helper'
import { credential } from './types'
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

class SSHCredentialGuard {
    private credentialManager = new CredentialManager()

    private ssh = new NodeSSH()

    async validatePrivateAccount(hpcName: string, user: string, password: string): Promise<void> {
        const hpc = hpcConfigMap[hpcName]
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

    async registerCredential(user: string, password: string): Promise<string> {
        const credentialId = Helper.generateId()
        this.credentialManager.add(credentialId, {
            id: credentialId,
            user: user,
            password: password
        })
        return credentialId
    }
}

export default SSHCredentialGuard
export { CredentialManager, SSHCredentialGuard }