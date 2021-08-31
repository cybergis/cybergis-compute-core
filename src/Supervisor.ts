import Queue from "./Queue"
import Emitter from "./Emitter"
import { Job } from "./models/Job"
import { SSH, SSHConfig, slurmCeiling } from './types'
import { config, maintainerConfigMap, hpcConfigMap } from '../configs/config'
import { FileSystem, GitFolder } from './FileSystem'
import * as events from 'events'
import NodeSSH = require('node-ssh')
import SlurmConnector from "./connectors/SlurmConnector"

type actions = 'stop' | 'resume' | 'cancel'

class Supervisor {

    private jobPoolCapacities: {[keys: string]: number } = {}

    private jobCommunitySSHCounters: {[keys: string]: number } = {}

    private jobPoolCounters: {[keys: string]: number} = {}

    public jobSSHPool: {[keys: string]: SSH} = {}

    private queues: {[keys: string]: Queue} = {}

    private emitter = new Emitter()

    private maintainerMasterThread = null

    private maintainerMasterEventEmitter = new events.EventEmitter()

    private queueConsumeTimePeriodInSeconds = config.queue_consume_time_period_in_seconds

    private actionQueue: {[keys: string]: actions[]} = {}

    constructor() {
        for (var hpcName in hpcConfigMap) {
            var hpcConfig = hpcConfigMap[hpcName]

            // register job pool & queues
            this.jobPoolCapacities[hpcName] = hpcConfig.job_pool_capacity
            this.jobPoolCounters[hpcName] = 0
            this.queues[hpcName] = new Queue(hpcName)

            if (!hpcConfig.is_community_account) continue

            // register community account SSH
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

        this.createMaintainerMaster()
    }

    createMaintainerMaster() {
        var self = this

        // queue consumer
        this.maintainerMasterThread = setInterval(async () => {
            for (var hpcName in self.jobPoolCounters) {
                while (self.jobPoolCounters[hpcName] < self.jobPoolCapacities[hpcName] && !await self.queues[hpcName].isEmpty()) {
                    var job = await self.queues[hpcName].shift()
                    if (!job) continue
                    var maintainer = require(`./maintainers/${maintainerConfigMap[job.maintainer].maintainer}`).default // typescript compilation hack
                    job.maintainerInstance = new maintainer(job, self)
                    self.jobPoolCounters[hpcName]++

                    // manage ssh pool
                    if (job.maintainerInstance.connector.config.is_community_account) {
                        self.jobCommunitySSHCounters[job.hpc]++
                    } else {
                        var hpcConfig = hpcConfigMap[job.hpc]
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

                    // emit event
                    self.emitter.registerEvents(job, 'JOB_REGISTERED', `job [${job.id}] is registered with the supervisor, waiting for initialization`)

                    // run worker
                    this.createMaintainerWorker(job)
                }
            }
        }, this.queueConsumeTimePeriodInSeconds * 1000)

        // remove job once ended
        this.maintainerMasterEventEmitter.on('job_end', (hpcName, jobName) => {
            if (config.is_testing) console.log(`received job_end event from ${jobName}`)
            self.jobPoolCounters[hpcName]--
        })
    }

    async createMaintainerWorker(job: Job) {
        var self = this

        while (true) {
            // get ssh connector from pool
            var ssh: SSH
            if (job.maintainerInstance.connector.config.is_community_account) {
                ssh = self.jobSSHPool[job.hpc]
            } else {
                ssh = self.jobSSHPool[job.id]
            }

            // connect ssh & run
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

            // emit events & logs
            var events = job.maintainerInstance.dumpEvents()
            var logs = job.maintainerInstance.dumpLogs()
            for (var j in events) self.emitter.registerEvents(job, events[j].type, events[j].message)
            for (var j in logs) self.emitter.registerLogs(job, logs[j])

            // ending conditions
            if (job.maintainerInstance.isEnd) {
                // exit or deflag ssh pool
                if (job.maintainerInstance.connector.config.is_community_account) {
                    self.jobCommunitySSHCounters[job.hpc]--
                    if (self.jobCommunitySSHCounters[job.hpc] === 0) {
                        if (ssh.connection.isConnected()) await ssh.connection.dispose()
                    }
                } else {
                    if (ssh.connection.isConnected()) await ssh.connection.dispose()
                    delete self.jobSSHPool[job.id]
                }

                // emit event
                this.maintainerMasterEventEmitter.emit('job_end', job.hpc, job.id)

                // exit loop
                return
            }
        }
    }

    async pushJobToQueue(job: Job) {
        this._validateMaintainerExecutableFolder(job)
        await this._validateSlurmConfig(job)
        await this.queues[job.hpc].push(job)
        this.emitter.registerEvents(job, 'JOB_QUEUED', 'job [' + job.id + '] is queued, waiting for registration')
    }

    private _validateMaintainerExecutableFolder(job: Job) {
        const maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            if (job.executableFolder == undefined) throw new Error('no file provided')
            var file = FileSystem.getFolderByURL(job.executableFolder, maintainerConfig.executable_folder.allowed_protocol)
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
        clearInterval(this.maintainerMasterThread)
    }
}

export default Supervisor