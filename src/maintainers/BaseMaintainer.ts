import { Job } from "../models/Job"
import { maintainerConfig, event, slurm } from "../types"
import { BaseFolder, LocalFolder, FileSystem, GitFolder } from '../FileSystem'
import BaseConnector from '../connectors/BaseConnector'
import SlurmConnector from '../connectors/SlurmConnector'
import validator from 'validator'
import { NotImplementedError } from '../errors'
import { config, hpcConfigMap, maintainerConfigMap } from '../../configs/config'
import SingularityConnector from "../connectors/SingularityConnector"
import Supervisor from '../Supervisor'

class BaseMaintainer {
    /** parent pointer **/
    public supervisor: Supervisor

    /** packages **/
    public validator = validator // https://github.com/validatorjs/validator.js

    /** config **/
    public job: Job = undefined

    public config: maintainerConfig = undefined

    public id: string = undefined

    public slurm: slurm = undefined

    public fileSystem: FileSystem = undefined

    /** mutex **/
    private _lock = false

    /** states **/
    public isInit = false

    public isEnd = false

    public isPaused = false

    protected lifeCycleState = {
        initCounter: 0,
        createdAt: null,
    }

    /** parameters **/
    public initRetry = 3

    public maintainThresholdInHours = 0.1

    public envParamValidators: {[keys: string]: (val: string) => boolean} = undefined

    public envParamDefault: {[keys: string]: string} = {}

    public envParam: {[keys: string]: string} = {}

    public appParamValidators = undefined
 
    public appParam: {[keys: string]: string} = {}

    /** constructor **/
    constructor(job: Job, supervisor: Supervisor) {
        for (var i in this.envParamValidators) {
            var val = job.env[i]
            if (val != undefined) {
                if (this.envParamValidators[i](val)) this.envParam[i] = val
            }
        }
        const fileSystem = new FileSystem()
        const maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            this.executableFolder = fileSystem.getFolderByURL(job.executableFolder)
        } else {
            this.executableFolder = fileSystem.createLocalFolder()
        }
        this.supervisor = supervisor
        this.fileSystem = fileSystem
        this.job = job
        this.config = maintainerConfig
        this.id = job.id
        this.slurm = job.slurm
        this.onDefine()
    }

    /** HPC connectors **/
    public connector: BaseConnector | SlurmConnector = undefined

    /** files **/
    public dataFolder: BaseFolder = undefined

    public resultFolder: BaseFolder = undefined

    public executableFolder: BaseFolder = undefined

    /** data **/
    protected logs: Array<string> = []

    protected events: Array<event> = []

    /** lifecycle interfaces **/
    onDefine() {
        throw new NotImplementedError("onDefine not implemented")
    }

    async onInit() {
        throw new NotImplementedError("onInit not implemented")
    }

    async onMaintain() {
        throw new NotImplementedError("onMaintain not implemented")
    }

    async onPause() {
        throw new NotImplementedError("onPause not implemented")
    }

    async onResume() {
        throw new NotImplementedError("onResume not implemented")
    }

    async onCancel() {
        throw new NotImplementedError("onCancel not implemented")
    }

    /** emitters **/
    emitEvent(type: string, message: string) {
        if (type === 'JOB_INIT') this.isInit = true
        if (type === 'JOB_ENDED' || type === 'JOB_FAILED') this.isEnd = true
        this.events.push({
            type: type,
            message: message
        })
    }

    emitLog(message: string) {
        this.logs.push(message)
    }

    /** supervisor interfaces **/
    async init() {
        if (this._lock) return
        this._lock = true

        if (this.lifeCycleState.initCounter >= this.initRetry) {
            this.emitEvent('JOB_FAILED', 'initialization counter exceeds ' + this.initRetry + ' counts')
        } else {
            await this.onInit()
            this.lifeCycleState.initCounter++
        }

        this._lock = false
    }

    async maintain() {
        if (this._lock) return
        this._lock = true

        if (this.lifeCycleState.createdAt === null) {
            this.lifeCycleState.createdAt = Date.now()
        }

        if (((this.lifeCycleState.createdAt - Date.now()) / (1000 * 60 * 60)) >= this.maintainThresholdInHours) {
            this.emitEvent('JOB_FAILED', 'maintain time exceeds ' + this.maintainThresholdInHours + ' hours')
        } else {
            try {
                await this.onMaintain()
            } catch (e) {
                if (config.is_testing) console.error(e.toString()) // ignore error
            }
        }

        this._lock = false
    }

    dumpLogs() {
        var logs = this.logs
        this.logs = []
        return logs
    }

    dumpEvents() {
        var events = this.events
        this.events = []
        return events
    }


    public getSlurmConnector(): SlurmConnector {
        var hpc = this.job.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new SlurmConnector(this.job, hpcConfig, this)
    }

    public getSingularityConnector(): SingularityConnector {
        var hpc = this.job.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new SingularityConnector(this.job, hpcConfig, this)
    }

    public getBaseConnector(): BaseConnector {
        var hpc = this.job.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new BaseConnector(this.job, hpcConfig, this)
    }
}

export default BaseMaintainer