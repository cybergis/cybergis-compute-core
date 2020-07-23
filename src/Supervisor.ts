import Queue from "./Queue"
import Emitter from "./Emitter"
import Helper from "./Helper"
import { manifest } from './types'
import constant from './constant'

class Supervisor {

    private jobPoolCapacities = {}

    private jobPools = {}

    private queues = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private workerTimePeriodInSeconds = 1

    constructor() {
        var self = this

        for (var service in constant.destinationMap) {
            var destination = constant.destinationMap[service]
            this.jobPoolCapacities[service] = destination.capacity
            this.jobPools[service] = []
            this.queues[service] = new Queue()
        }

        this.maintainerThread = setInterval(async function () {
            for (var service in self.jobPools) {
                var jobPool = self.jobPools[service]

                if (jobPool.length > 0) {
                    for (var i = 0; i < jobPool.length; i++) {
                        var job = jobPool[i]
                        if (job.maintainer.isInit) {
                            await job.maintainer.maintain()
                        } else {
                            await job.maintainer.init()
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

                        if (job.maintainer.isEnd) {
                            jobPool.splice(i, 1)
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

    private _generateJobID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }

    destroy() {
        clearInterval(this.maintainerThread)
    }
}

export default Supervisor