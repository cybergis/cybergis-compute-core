import Queue from "./Queue"
import Emitter from "./Emitter"
import { Job } from "./models/Job"
import { SSH, SSHConfig, hpcConfig, slurmCeiling } from './types'
import { config, maintainerConfigMap, hpcConfigMap } from '../configs/config'
import { FileSystem, LocalFolder, GitFolder } from './FileSystem'
import NodeSSH = require('node-ssh')
import SlurmConnector from "./connectors/SlurmConnector"

type actions = 'stop' | 'resume' | 'cancel'

class Supervisor {

    private jobPoolCapacities: {[keys: string]: number } = {}

    private jobCommunitySSHCounters: {[keys: string]: number } = {}

    private jobPools: {[keys: string]: Job[]} = {}

    public jobSSHPool: {[keys: string]: SSH} = {}

    public downloadPool: {[keys: string]: LocalFolder } = {}

    private queues: {[keys: string]: Queue} = {}

    private emitter = new Emitter()

    private maintainerThread = null

    private connectorThread = null

    private workerTimePeriodInSeconds = config.worker_time_period_in_seconds

    private actionQueue: {[keys: string]: actions[]} = {}

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

        this.maintainerThread = setInterval(async () => {
            for (var service in self.jobPools) {
                var jobPool = self.jobPools[service]

                for (var i = 0; i < jobPool.length; i++) {
                    var job = jobPool[i]
                    var ssh: SSH

                    if (job.maintainerInstance.connector.config.is_community_account) {
                        ssh = self.jobSSHPool[job.hpc]
                    } else {
                        ssh = self.jobSSHPool[job.id]
                    }

                    try {
                        if (!ssh.connection.isConnected()) await ssh.connection.connect(ssh.config)
                        await ssh.connection.execCommand('echo') // test connection
                        if (job.maintainerInstance.isInit) {
                            await job.maintainerInstance.maintain()
                        } else {
                            await job.maintainerInstance.init()
                        }
                    } catch (e) { 
                        if (config.is_testing) console.error(e.stack); continue
                    }

                    var events = job.maintainerInstance.dumpEvents()
                    var logs = job.maintainerInstance.dumpLogs()

                    for (var j in events) self.emitter.registerEvents(job, events[j].type, events[j].message)
                    for (var j in logs) self.emitter.registerLogs(job, logs[j])

                    if (job.maintainerInstance.isEnd) {
                        jobPool.splice(i, 1)

                        if (job.maintainerInstance.connector.config.is_community_account) {
                            self.jobCommunitySSHCounters[job.hpc]--
                            if (self.jobCommunitySSHCounters[job.hpc] === 0) {
                                if (ssh.connection.isConnected()) await ssh.connection.dispose()
                            }
                        } else {
                            if (ssh.connection.isConnected()) await ssh.connection.dispose()
                            delete self.jobSSHPool[job.id]
                        }
                        i--
                    }
                }

                while (jobPool.length < self.jobPoolCapacities[service] && !await self.queues[service].isEmpty()) {
                    var job = await self.queues[service].shift()
                    var maintainer = require(`./maintainers/${maintainerConfigMap[job.maintainer].maintainer}`).default // typescript compilation hack
                    job.maintainerInstance = new maintainer(job, self)
                    self.jobPools[service].push(job)
                    if (job.maintainerInstance.connector.config.is_community_account) {
                        self.jobCommunitySSHCounters[job.hpc]++
                    } else {
                        self.jobSSHPool[job.id] = {
                            connection: new NodeSSH(),
                            config: {
                                host: hpcConfig.ip,
                                port: hpcConfig.port,
                                username: job.credential.user,
                                password: job.credential.password,
                                readyTimeout: 1000
                            }
                        }
                    }
                    self.emitter.registerEvents(job, 'JOB_REGISTERED', `job [${job.id}] is registered with the supervisor, waiting for initialization`)
                }
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    async pushJobToQueue(job: Job) {
        this._validateMaintainerExecutableFolder(job)
        await this._validateSlurmConfig(job)
        await this.queues[job.maintainer].push(job)
        this.emitter.registerEvents(job, 'JOB_QUEUED', 'job [' + job.id + '] is queued, waiting for registration')
    }

    private _validateMaintainerExecutableFolder(job: Job) {
        const fileSystem = new FileSystem()
        const maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            if (job.executableFolder == undefined) throw new Error('no file provided')
            var file = fileSystem.getFolderByURL(job.executableFolder, maintainerConfig.executable_folder.allowed_protocol)
            file.validate()
        }
    }

    private async _validateSlurmConfig(job: Job) {
        if (!job.slurm) return

        var providedSlurmCeiling: slurmCeiling = {}
        const maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            var u = job.executableFolder.split('://')
            if (u[0] === 'git') {
                var f = new GitFolder(u[1])
                var m = await f.getExecutableManifest()
                if (m.slurm_ceiling) {
                    providedSlurmCeiling = m.slurm_ceiling
                }
            }
        }

        SlurmConnector.validateSlurmConfig(job.slurm, providedSlurmCeiling)
    }

    destroy() {
        clearInterval(this.maintainerThread)
        clearInterval(this.connectorThread)
    }
}

export default Supervisor