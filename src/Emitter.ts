const redis = require('redis')
const config = require('../config.json')
const { promisify } = require("util")

class Emitter {
    private events = {}

    private logs = {}

    private isConnected = false

    private redis = {
        push: null,
        fetch: null,
        indexFetch: null,
        indexPush: null
    }

    async registerEvents(uid: number, jobID: string, type: string, message: string) {
        await this.connect()
        await this.redis.indexPush('event_' + uid, 'event_' + uid + '_' + jobID)
        await this.redis.push(['event_' + uid + '_' + jobID, JSON.stringify({
            type: type,
            message: message,
            at: new Date()
        })])
    }

    async registerLogs(uid: number, jobID: string, message: string) {
        await this.connect()
        await this.redis.indexPush('log_' + uid, 'log_' + uid + '_' + jobID)
        await this.redis.push(['log_' + uid + '_' + jobID, JSON.stringify({
            message: message,
            at: new Date()
        })])
    }

    async status(uid: number, jobID = null) {
        await this.connect()

        if (jobID === null) {
            var usrLogs = {}
            var usrEvents = {}
            var logIndex = await this.redis.indexFetch('log_' + uid)
            var eventIndex = await this.redis.indexFetch('event_' + uid)

            for (var i in logIndex) {
                var jobID = logIndex[i].replace('log_' + uid + '_', '')
                var logs = await this.redis.fetch(logIndex[i], 0, -1)
                for (var i in logs) {
                    logs[i] = JSON.parse(logs[i])
                }
                usrLogs[jobID] = logs
            }

            for (var i in eventIndex) {
                var jobID = eventIndex[i].replace('event_' + uid + '_', '')
                var events = await this.redis.fetch(eventIndex[i], 0, -1)
                for (var i in events) {
                    events[i] = JSON.parse(events[i])
                }
                usrEvents[jobID] = events
            }

            return {
                events: usrEvents,
                logs: usrLogs
            }
        } else {
            var events = await this.redis.fetch('event_' + uid + '_' + jobID, 0, -1)
            var logs = await this.redis.fetch('log_' + uid + '_' + jobID, 0, -1)

            for (var i in events) {
                events[i] = JSON.parse(events[i])
            }

            for (var i in logs) {
                logs[i] = JSON.parse(logs[i])
            }

            return {
                events: events,
                logs: logs
            }
        }
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

            this.redis.push = promisify(client.rpush).bind(client)
            this.redis.fetch = promisify(client.lrange).bind(client)
            this.redis.indexPush = promisify(client.sadd).bind(client)
            this.redis.indexFetch = promisify(client.smembers).bind(client)
            this.isConnected = true
        }
    }
}

export default Emitter