import { Job } from "./models/Job"
import * as fs from 'fs'

var Helper = {
    btoa(target: string): string {
        return Buffer.from(target, 'base64').toString('binary')
    },

    atob(target: string): string {
        return Buffer.from(target).toString('base64')
    },

    generateId(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(5)
    },

    job2object(job: Job | Job[], exclude = []): Object | Object[] {
        if (Array.isArray(job)) {
            var outArray: Object[] = []
            for (var i in job) {
                outArray.push(Helper.job2object(job[i]))
            }
            return outArray
        }
        //
        var out = {}
        var include = ['id', 'userId', 'secretToken', 'slurmId', 'maintainer', 'hpc', 'executableFolder', 'dataFolder', 'resultFolder', 'param', 'env', 'slurm', 'createdAt', 'updatedAt', 'deletedAt', 'initializedAt', 'finishedAt', 'isFailed', 'events', 'logs']
        for (var i in include) {
            i = include[i]
            if (exclude.includes(i)) continue
            if (i in job) out[i] = job[i]
                else out[i] = null
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