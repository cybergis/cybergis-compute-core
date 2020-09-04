import JAT from './JAT'
import Helper from './Helper'
import { manifest, aT } from './types'
import SSH from './SSH'
const redis = require('redis')
const config = require('../config.json')
const { promisify } = require("util")

class SecretTokens {
    private indexName = 'sT'

    private redis = {
        push: null,
        keys: null,
        getValue: null,
        length: null,
        setValue: null
    }

    private isConnected = false

    constructor() {
        //
    }

    async add(sT: string, data: any) {
        await this.connect()
        await this.redis.push(this.indexName, sT)
        await this.redis.setValue(sT, JSON.stringify(data))
    }

    async getAll() {
        await this.connect()
        return await this.redis.keys(this.indexName)
    }

    async getManifestByST(sT: string) {
        await this.connect()
        return JSON.parse(await this.redis.getValue(sT))
    }

    async exists(sT: string) {
        await this.connect()
        return await this.redis.getValue(sT) != undefined
    }

    private async connect() {
        if (!this.isConnected) {
            var client = new redis.createClient({
                host: config.redis.host,
                port: config.redis.port
            })

            if (config.redis.password != null && config.redis.password != undefined) {
                var redisAuth = promisify(client.auth).bind(client)
                await redisAuth(config.redis.password)
            }

            this.redis.push = promisify(client.sadd).bind(client)
            this.redis.keys = promisify(client.smembers).bind(client)
            this.redis.getValue = promisify(client.get).bind(client)
            this.redis.setValue = promisify(client.set).bind(client)
            this.redis.length = promisify(client.scard).bind(client)
            this.isConnected = true
        }
    }
}

class Guard {
    private jat = new JAT()

    private authenticatedAccessTokenCache = {}

    private secretTokens = new SecretTokens()

    async issueSecretTokenForPrivateAccount(destination: string, user: string, password: string): Promise<string> {
        this._clearCache()
        var ssh = new SSH(destination, user, password)
        await ssh.connect()
        var isValid = ssh.isConnected()
        await ssh.stop()

        if (!isValid) {
            throw new Error('unable to check credentials with ' + destination)
        }

        var secretToken = Helper.randomStr(45)

        while (await this.secretTokens.exists(secretToken)) {
            secretToken = Helper.randomStr(45)
        }

        await this.secretTokens.add(secretToken, {
            cred: {
                usr: user,
                pwd: password
            },
            dest: destination,
            sT: secretToken,
            uid: this._generateUserID()
        })

        return secretToken
    }

    async issueSecretTokenForCommunityAccount(destination: string, user: string) {
        this._clearCache()

        var secretToken = Helper.randomStr(45)

        while (await this.secretTokens.exists(secretToken)) {
            secretToken = Helper.randomStr(45)
        }

        await this.secretTokens.add(secretToken, {
            cred: {
                usr: user,
                pwd: null
            },
            dest: destination,
            sT: secretToken,
            uid: this._generateUserID()
        })

        return secretToken
    }

    async validateAccessToken(manifest: manifest | aT): Promise<manifest | aT> {
        this._clearCache()

        var rawAT = this.jat.parseAccessToken(manifest.aT)
        var date = this.jat.getDate()

        if (rawAT.payload.decoded.date != date) {
            throw new Error('invalid accessToken provided')
        }

        if (this.authenticatedAccessTokenCache[date] != undefined) {
            var cache = this.authenticatedAccessTokenCache[date][rawAT.hash]
            if (cache != undefined) {
                delete manifest.aT
                manifest.cred = cache.cred
                manifest.uid = cache.uid
                manifest.dest = cache.dest
                return manifest
            }
        }

        var keys = await this.secretTokens.getAll()
        for (var i in keys) {
            var sT = keys[i]
            var secretToken = await this.secretTokens.getManifestByST(sT)
            if (secretToken.dest === manifest.dest || manifest.dest === undefined) {
                var hash: string = this.jat.init(rawAT.alg, secretToken.sT).hash(rawAT.payload.encoded)
                if (hash == rawAT.hash) {
                    if (this.authenticatedAccessTokenCache[date] === undefined) {
                        this.authenticatedAccessTokenCache[date] = {}
                    }
                    this.authenticatedAccessTokenCache[date][rawAT.hash] = {
                        cred: secretToken.cred,
                        uid: secretToken.uid,
                        dest: secretToken.dest
                    }
                    delete manifest.aT
                    manifest.cred = secretToken.cred
                    manifest.uid = secretToken.uid
                    manifest.dest = secretToken.dest
                    return manifest
                }
            }
        }

        throw new Error('invalid accessToken provided')
    }

    revokeSecretToken(secretToken: string) {
        delete this.secretTokens[secretToken]
    }

    private async _clearCache() {
        var date = this.jat.getDate()
        for (var i in this.authenticatedAccessTokenCache) {
            if (parseInt(i) < date) {
                delete this.authenticatedAccessTokenCache[i]
            }
        }
    }

    private _generateUserID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }
}

export default Guard