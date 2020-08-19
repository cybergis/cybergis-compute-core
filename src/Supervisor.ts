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

    private downloadPools = {}

    private queues = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private workerTimePeriodInSeconds = 1

    constructor() {
        var self = this

        for (var service in constant.destinationMap) {
            var destination = constant.destinationMap[service]
            this.jobPoolCapacities[service] = destination.jobPoolCapacity
            this.jobPools[service] = []
            this.queues[service] = new Queue()
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
                            if (job.maintainer.downloadDir != undefined) {
                                self.downloadPools[job.maintainer.getJobID()] = job.maintainer.downloadDir
                            }
                            i--
                        }
                    }
                }

                while (jobPool.length < self.jobPoolCapacities[service] && !self.queues[service].isEmpty()) {
                    var job = self.queues[service].shift()
                    var maintainer = require('./maintainers/' + constant.destinationMap[job.dest].maintainer).default // typescript compilation hack
                    job.maintainer = new maintainer(job)
                    jobPool.push(job)
                    self.emitter.registerEvents(job.uid, job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization')
                }
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    add(manifest: manifest) {
        manifest.id = this._generateJobID()
        this.queues[manifest.dest].push(manifest)
        this.emitter.registerEvents(manifest.uid, manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration')
        return manifest
    }

    status(uid: number, jobID: string = null) {
        return this.emitter.status(uid, jobID)
    }

    async getDownloadDir(jobID: string): Promise<string> {
        var dir = __dirname + '/../data/download/' + jobID + '.zip'
        if (!fs.existsSync(dir)) {
            if (this.downloadPools[jobID] != undefined) {
                var self = this
                await new Promise((resolve, reject) => {
                    var stream = fs.createWriteStream(dir)
                    var archive = archiver('zip')
                    archive.pipe(stream)
                    archive.directory(self.downloadPools[jobID], false)
                    archive.finalize()
                    archive.on('error', function (err) {
                        console.log('la')
                        reject(err)
                    })
                    stream.on('end', function () {
                        resolve('')
                    })
                    stream.on('close', function () {
                        resolve('')
                    })
                })
                return dir
            } else {
                return null
            }
        } else {
            return dir
        }
    }

    private _generateJobID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }

    destroy() {
        clearInterval(this.maintainerThread)
    }
}

export default Supervisor