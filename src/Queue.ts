import { manifest } from './types'
const redis = require('redis')
const config = require('../config.json')
const { promisify } = require("util")

class Queue {
    private name

    private redis = {
        push: null,
        shift: null,
        peak: null,
        length: null
    }

    private isConnected = false

    constructor(name: string) {
        this.name = name
    }

    async push(item: manifest) {
        await this.connect()
        var itemString = JSON.stringify(item)
        await this.redis.push([this.name, itemString])
    }

    async shift() {
        await this.connect()
        return JSON.parse(await this.redis.shift(this.name))
    }

    async isEmpty() {
        await this.connect()
        return await this.redis.length(this.name) === 0
    }

    async peak() {
        await this.connect()
        return await this.isEmpty() ? undefined : JSON.parse(await this.redis.peak(this.name, 0, 0))
    }

    async length() {
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
}

export default Queue