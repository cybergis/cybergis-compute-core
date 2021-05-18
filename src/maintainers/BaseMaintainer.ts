import Helper from "../Helper"
import { manifest, maintainerConfig, event } from "../types"
import { BaseFile, LocalFile, FileSystem } from '../FileSystem'
import BaseConnector from '../connectors/BaseConnector'
import SlurmConnector from '../connectors/SlurmConnector'
import validator from 'validator'
import { NotImplementedError } from '../errors'
import { config, hpcConfigMap, maintainerConfigMap } from '../../configs/config'
import SingularityConnector from "../connectors/SingularityConnector"

class BaseMaintainer {
    /** packages **/
    public validator = validator // https://github.com/validatorjs/validator.js

    /** config **/
    private rawManifest: manifest = undefined

    public manifest: manifest = undefined // secure manifest with no credentials

    public config: maintainerConfig = undefined

    public id: string = undefined

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
    constructor(manifest: manifest) {
        for (var i in this.envParamValidators) {
            var val = manifest.env[i]
            if (val != undefined) {
                if (this.envParamValidators[i](val)) this.envParam[i] = val
            }
        }
        const fileSystem = new FileSystem()
        const maintainerConfig = maintainerConfigMap[manifest.maintainer]
        if (maintainerConfig.executable_file) {
            if (maintainerConfig.executable_file.from_user_upload) {
                this.executableFile = fileSystem.getLocalFileByURL(manifest.file)
            } else {
                this.executableFile = fileSystem.createLocalFile()
            }
        }
        this.fileSystem = fileSystem
        this.rawManifest = manifest
        this.manifest = Helper.hideCredFromManifest(manifest)
        this.config = maintainerConfig
        this.id = manifest.id
        this.onDefine()
    }

    /** HPC connectors **/
    public connector: BaseConnector | SlurmConnector = undefined

    /** files **/
    public dataFile: BaseFile = undefined

    public downloadFile: LocalFile = undefined

    public executableFile: LocalFile = undefined

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
            await this.connector.connect()
            await this.onInit()
            await this.connector.disconnect()
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
                await this.connector.connect()
                await this.onMaintain()
                await this.connector.disconnect()
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
        var hpc = this.rawManifest.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new SlurmConnector(this.rawManifest, hpcConfig, this)
    }

    public getSingularityConnector(): SingularityConnector {
        var hpc = this.rawManifest.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new SingularityConnector(this.rawManifest, hpcConfig, this)
    }

    public getBaseConnector(): BaseConnector {
        var hpc = this.manifest.hpc
        if (hpc == undefined) hpc = this.config.default_hpc
        var hpcConfig = hpcConfigMap[hpc]
        if (hpcConfig == undefined) {
            throw new Error("cannot find hpc with name [" + hpc + "]")
        }
        return new BaseConnector(this.manifest, hpcConfig, this)
    }
}

export default BaseMaintainer