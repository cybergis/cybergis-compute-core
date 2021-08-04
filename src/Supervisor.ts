import Queue from "./Queue"
import Emitter from "./Emitter"
import Helper from "./Helper"
import { manifest } from './types'
import constant from './constant'
const fs = require('fs')
const archiver = require('archiver')

class Supervisor {

    private jobPoolCapacities = {}

    private jobPools = {}

    public downloadPools = {}

    private queues = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private workerTimePeriodInSeconds = 10

    constructor() {
        var self = this

        for (var service in constant.destinationMap) {
            var destination = constant.destinationMap[service]
            this.jobPoolCapacities[service] = destination.jobPoolCapacity
            this.jobPools[service] = []
            this.queues[service] = new Queue(service)
        }

        this.maintainerThread = setInterval(async function () {
            for (var service in self.jobPools) {
                var jobPool = self.jobPools[service]

                if (jobPool.length > 0) {
                    for (var i = 0; i < jobPool.length; i++) {
                        var job = jobPool[i]
                        var jobThrowError = false

                        if (job.maintainer.isInit) {
                            try {
                                await job.maintainer.maintain()
                            } catch {
                                jobThrowError = true
                            }
                        } else {
                            try {
                                await job.maintainer.init()
                            } catch {
                                jobThrowError = true
                            }
                        }

                        var events = job.maintainer.dumpEvents()
                        var logs = job.maintainer.dumpLogs()

                        for (var j in events) {
                            var event = events[j]
                            self.emitter.registerEvents(job.uid, job.maintainer.getJobID(), event.type, event.message)
                        }

                        for (var j in logs) {
                            self.emitter.registerLogs(job.uid, job.maintainer.getJobID(), logs[j])
                        }

                        if (job.maintainer.isEnd || jobThrowError) {
                            jobPool.splice(i, 1)
                            if (job.maintainer.downloadedPath != undefined) {
                                self.downloadPools[job.maintainer.getJobID()] = job.maintainer.downloadedPath
                            }
                            i--
                        }
                    }
                }

                while (jobPool.length < self.jobPoolCapacities[service] && !await self.queues[service].isEmpty()) {
                    var job = await self.queues[service].shift()
                    var maintainer = require('./maintainers/' + constant.destinationMap[job.dest].maintainer).default // typescript compilation hack
                    job.maintainer = new maintainer(job)
                    jobPool.push(job)
                    self.emitter.registerEvents(job.uid, job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization')
                }
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    async add(manifest: manifest) {
        const dest = constant.destinationMap[manifest.dest]

        if (dest.useUploadedFile) {
            if (manifest.file != undefined) {
                if (!fs.existsSync(__dirname + '/../data/upload/' + manifest.uid + '/' + manifest.file)) {
                    throw new Error('file [' + manifest.file + '] not exists')
                }
            } else {
                throw new Error('no file provided')
            }
        }

        manifest.id = this._generateJobID()
        await this.queues[manifest.dest].push(manifest)
        this.emitter.registerEvents(manifest.uid, manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration')
        return manifest
    }

    async status(uid: number, jobID: string = null) {
        return await this.emitter.status(uid, jobID)
    }

    async getDownloadDir(jobID: string): Promise<string> {
        var filePath = this.downloadPools[jobID]

        if (filePath == undefined) {
            return null
        }

        if (fs.lstatSync(filePath).isDirectory()) {
            var zipFilePath = __dirname + '/../data/download/' + jobID + '.zip'
            if (!fs.existsSync(zipFilePath)) {
                await new Promise((resolve, reject) => {
                    var stream = fs.createWriteStream(zipFilePath)
                    var archive = archiver('zip')
                    archive.pipe(stream)
                    archive.directory(filePath, false)
                    archive.finalize()
                    archive.on('error', function (err) {
                        reject(err)
                    })
                    stream.on('end', function () {
                        resolve('')
                    })
                    stream.on('close', function () {
                        resolve('')
                    })
                })
            }
            filePath = zipFilePath
        }

        return filePath
    }

    private _generateJobID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }

    destroy() {
        clearInterval(this.maintainerThread)
    }
}

export default Supervisor