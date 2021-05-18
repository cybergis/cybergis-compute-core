import Queue from "./Queue"
import Emitter from "./Emitter"
import Helper from "./Helper"
import { manifest } from './types'
import { config, maintainerConfigMap } from '../configs/config'
import { FileSystem, LocalFile } from './FileSystem'

class Supervisor {

    private jobPoolCapacities: {[keys: string]: number } = {}

    private jobPools: {[keys: string]: manifest[]} = {}

    public downloadPool: {[keys: string]: LocalFile } = {}

    private queues: {[keys: string]: Queue} = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private workerTimePeriodInSeconds = config.worker_time_period_in_seconds

    constructor() {
        var self = this

        for (var key in maintainerConfigMap) {
            var maintainerConfig = maintainerConfigMap[key]
            this.jobPoolCapacities[key] = maintainerConfig.job_pool_capacity
            this.jobPools[key] = []
            this.queues[key] = new Queue(key)
        }

        this.maintainerThread = setInterval(async () => {
            for (var service in self.jobPools) {
                var jobPool = self.jobPools[service]

                if (jobPool.length > 0) {
                    for (var i = 0; i < jobPool.length; i++) {
                        var job = jobPool[i]

                        if (job._maintainer.isInit) {
                            try { await job._maintainer.maintain() } catch (e) {
                                if (config.is_testing) console.error(e.toString()); continue
                            }
                        } else {
                            try { await job._maintainer.init() } catch (e) { 
                                if (config.is_testing) console.error(e.toString()); continue
                            }
                        }

                        var events = job._maintainer.dumpEvents()
                        var logs = job._maintainer.dumpLogs()

                        for (var j in events) {
                            var event = events[j]
                            self.emitter.registerEvents(job.uid, job._maintainer.id, event.type, event.message)
                        }

                        for (var j in logs) self.emitter.registerLogs(job.uid, job._maintainer.id, logs[j])

                        if (job._maintainer.isEnd) {
                            jobPool.splice(i, 1)
                            if (job._maintainer.downloadFile != undefined) {
                                self.downloadPool[job._maintainer.id] = job._maintainer.downloadFile
                            }
                            i--
                        }
                    }
                }

                while (jobPool.length < self.jobPoolCapacities[service] && !await self.queues[service].isEmpty()) {
                    var job = await self.queues[service].shift()
                    var maintainer = require(`./maintainers/${maintainerConfigMap[job.maintainer].maintainer}`).default // typescript compilation hack
                    job._maintainer = new maintainer(job)
                    self.jobPools[service].push(job)
                    self.emitter.registerEvents(job.uid, job.id, 'JOB_REGISTERED', `job [${job.id}] is registered with the supervisor, waiting for initialization`)
                }
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    async pushJobToQueue(manifest: manifest) {
        this._validateMaintainerExecutableFile(manifest)
        await this.queues[manifest.maintainer].push(manifest)
        this.emitter.registerEvents(manifest.uid, manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration')
        return manifest
    }

    async getJobStatus(uid: number, jobID: string = null) {
        return await this.emitter.status(uid, jobID)
    }

    getJobDownload(jobID: string): LocalFile {
        return this.downloadPool[jobID]
    }

    private _validateMaintainerExecutableFile(manifest: manifest) {
        const fileSystem = new FileSystem()
        const maintainerConfig = maintainerConfigMap[manifest.maintainer]
        if (maintainerConfig.executable_file.from_user_upload) {
            if (manifest.file == undefined) throw new Error('no file provided')
            var file = fileSystem.getFileByURL(manifest.file)
            if (file == undefined) throw new Error('cannot find file [' + manifest.file + ']')
            if (file.type != 'local') throw new Error('execution file only support file type local')
            file.validate()
        }
    }

    destroy() {
        clearInterval(this.maintainerThread)
    }
}

export default Supervisor