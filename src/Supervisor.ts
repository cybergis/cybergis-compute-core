import Queue from "./Queue"
import Emitter from "./Emitter"
import Helper from "./Helper"
import { manifest } from './types'
import constant from './constant'

class Supervisor {

    private jobPoolCapacity = 5

    private jobPool = []

    private queue = new Queue()

    private emitter = new Emitter()

    private worker = null

    private workerTimePeriodInSeconds = 1

    constructor() {
        var self = this

        this.worker = setInterval(async function () {
            if (self.jobPool.length > 0) {
                for (var i in self.jobPool) {
                    var job = self.jobPool[i]
                    if (job.maintainer.isInit) {
                        job.maintainer.lock()
                        await job.maintainer.onMaintain()
                        job.maintainer.unlock()
                    } else {
                        job.maintainer.lock()
                        await job.maintainer.onInit()
                        job.maintainer.unlock()
                    }

                    var events = job.maintainer.dumpEvents()
                    var logs = job.maintainer.dumpLogs()

                    for (var i in events) {
                        var event = events[i]
                        self.emitter.registerEvents(job.maintainer.getJobID(), event.type, event.message)
                    }

                    for (var i in logs) {
                        self.emitter.registerLogs(job.maintainer.getJobID(), logs[i])
                    }

                    if (job.maintainer.isEnd) {
                        delete job.jobPool[i]
                    }
                }
            }

            while (self.jobPool.length < self.jobPoolCapacity && !self.queue.isEmpty()) {
                var job = self.queue.shift()
                var maintainer = require('./maintainers/' + constant.destinationMap[job.dest].maintainer).default // typescript compilation hack
                job.maintainer = new maintainer(job)
                self.jobPool.push(job)
                self.emitter.registerEvents(job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization')
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    add(manifest: manifest) {
        manifest.id = this._generateJobID()
        this.queue.push(manifest)
        this.emitter.registerEvents(manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration')
        return manifest
    }

    status(jobID: string) {
        return this.emitter.status(jobID)
    }

    private _generateJobID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(2)
    }
}

export default Supervisor