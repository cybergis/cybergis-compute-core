import { Job } from "./models/Job"
import * as fs from 'fs'

var Helper = {
    btoa(target: string): string {
        return Buffer.from(target, 'base64').toString('binary')
    },

    atob(target: string): string {
        return Buffer.from(target).toString('base64')
    },

    job2object(job: Job, exclude = []): Object {
        var out = {}
        var include = ['id', 'userId', 'secretToken', 'slurmId', 'maintainer', 'hpc', 'executableFolder', 'dataFolder', 'resultFolder', 'param', 'env', 'slurm', 'createdAt', 'updatedAt', 'deletedAt', 'initializedAt', 'finishedAt', 'isFailed', 'events', 'logs']

        for (var i in job) {
            if (!exclude.includes(i) && include.includes(i)) {
                out[i] = job[i]
            }
        }

        return out
    },

    prepareDataForDB(data, properties) {
        var out = {}
        for (var i in properties) {
            var property = properties[i]
            if (data[property]) out[property] = data[property]
        }
        return out
    },

    randomStr(length): string {
        var result = ''
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength))
        }
        return result
    },

    fileModifiedDate (path: string): Date {  
        const { mtime } = fs.statSync(path)
        return mtime
    },

    onExit(callback) {
        //do something when app is closing
        process.on('exit', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        //catches ctrl+c event
        process.on('SIGINT', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('SIGUSR2', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('SIGTERM', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('uncaughtException', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })
    },

    consoleEnd: '\x1b[0m',

    consoleGreen: '\x1b[32m'
}

export default Helper