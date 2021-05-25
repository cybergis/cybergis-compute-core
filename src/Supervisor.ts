import Queue from "./Queue"
import Emitter from "./Emitter"
import { manifest, SSH, SSHConfig, hpcConfig } from './types'
import { config, maintainerConfigMap, hpcConfigMap } from '../configs/config'
import { FileSystem, LocalFolder } from './FileSystem'
import NodeSSH = require('node-ssh')

class Supervisor {

    private jobPoolCapacities: {[keys: string]: number } = {}

    private jobCommunitySSHCounters: {[keys: string]: number } = {}

    private jobPools: {[keys: string]: manifest[]} = {}

    public jobSSHPool: {[keys: string]: SSH} = {}

    public downloadPool: {[keys: string]: LocalFolder } = {}

    private queues: {[keys: string]: Queue} = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private connectorThread = null

    private workerTimePeriodInSeconds = config.worker_time_period_in_seconds

    constructor() {
        var self = this

        // create job queue
        for (var key in maintainerConfigMap) {
            var maintainerConfig = maintainerConfigMap[key]
            this.jobPoolCapacities[key] = maintainerConfig.job_pool_capacity
            this.jobPools[key] = []
            this.queues[key] = new Queue(key)
        }

        // register community account SSH
        for (var hpcName in hpcConfigMap) {
            var hpcConfig = hpcConfigMap[hpcName]
            if (!hpcConfig.is_community_account) continue

            this.jobCommunitySSHCounters[hpcName] = 0

            var sshConfig: SSHConfig = {
                host: hpcConfig.ip,
                port: hpcConfig.port,
                username: hpcConfig.community_login.user
            }

            if (hpcConfig.community_login.use_local_key) {
                sshConfig.privateKey = config.local_key.private_key_path
                if (config.local_key.passphrase) sshConfig.passphrase = config.local_key.passphrase
            } else {
                sshConfig.privateKey = hpcConfig.community_login.external_key.private_key_path
                if (hpcConfig.community_login.external_key.passphrase)
                    sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase
            }

            this.jobSSHPool[hpcName] = {
                connection: new NodeSSH(),
                config: sshConfig
            }
        }

        this.connectorThread = setInterval(async () => {
            for (var i in this.jobSSHPool) {
                var ssh = this.jobSSHPool[i].connection
                if (ssh.isConnected()) await ssh.dispose()
            }
        }, 4 * 60 * 1000) // disconnect every 4 hours

        this.maintainerThread = setInterval(async () => {
            for (var service in self.jobPools) {
                var jobPool = self.jobPools[service]

                for (var i = 0; i < jobPool.length; i++) {
                    var job = jobPool[i]
                    var ssh: SSH

                    if (job._maintainer.connector.config.is_community_account) {
                        ssh = self.jobSSHPool[job.hpc]
                    } else {
                        ssh = self.jobSSHPool[job.id]
                    }

                    try {
                        if (!ssh.connection.isConnected()) await ssh.connection.connect(ssh.config)
                        await ssh.connection.execCommand('echo') // test connection
                        if (job._maintainer.isInit) {
                            await job._maintainer.maintain()
                        } else {
                            await job._maintainer.init()
                        }
                    } catch (e) { 
                        if (config.is_testing) console.error(e.stack); continue
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

                        if (job._maintainer.connector.config.is_community_account) {
                            self.jobCommunitySSHCounters[job.hpc]--
                            if (self.jobCommunitySSHCounters[job.hpc] === 0) {
                                if (ssh.connection.isConnected()) await ssh.connection.dispose()
                            }
                        } else {
                            if (ssh.connection.isConnected()) await ssh.connection.dispose()
                            delete self.jobSSHPool[job.id]
                        }

                        if (job._maintainer.resultFolder != undefined) {
                            self.downloadPool[job._maintainer.id] = job._maintainer.resultFolder
                        }
                        i--
                    }
                }

                while (jobPool.length < self.jobPoolCapacities[service] && !await self.queues[service].isEmpty()) {
                    var job = await self.queues[service].shift()
                    var maintainer = require(`./maintainers/${maintainerConfigMap[job.maintainer].maintainer}`).default // typescript compilation hack
                    job._maintainer = new maintainer(job, self)
                    self.jobPools[service].push(job)
                    if (job._maintainer.connector.config.is_community_account) {
                        self.jobCommunitySSHCounters[job.hpc]++
                    } else {
                        self.jobSSHPool[job.id] = {
                            connection: new NodeSSH(),
                            config: {
                                host: hpcConfig.ip,
                                port: hpcConfig.port,
                                username: job.cred.usr,
                                password: job.cred.pwd,
                                readyTimeout: 1000
                            }
                        }
                    }
                    self.emitter.registerEvents(job.uid, job.id, 'JOB_REGISTERED', `job [${job.id}] is registered with the supervisor, waiting for initialization`)
                }
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    async pushJobToQueue(manifest: manifest) {
        this._validateMaintainerExecutableFolder(manifest)
        await this.queues[manifest.maintainer].push(manifest)
        this.emitter.registerEvents(manifest.uid, manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration')
        return manifest
    }

    async getJobStatus(uid: number, jobID: string = null) {
        return await this.emitter.status(uid, jobID)
    }

    getJobDownload(jobID: string): LocalFolder {
        return this.downloadPool[jobID]
    }

    private _validateMaintainerExecutableFolder(manifest: manifest) {
        const fileSystem = new FileSystem()
        const maintainerConfig = maintainerConfigMap[manifest.maintainer]
        if (maintainerConfig.executable_folder.from_user_upload) {
            if (manifest.file == undefined) throw new Error('no file provided')
            var file = fileSystem.getFileByURL(manifest.file)
            if (file == undefined) throw new Error('cannot find file [' + manifest.file + ']')
            if (file.type != 'local') throw new Error('execution file only support file type local')
            file.validate()
        }
    }

    destroy() {
        clearInterval(this.maintainerThread)
        clearInterval(this.connectorThread)
    }
}

export default Supervisor