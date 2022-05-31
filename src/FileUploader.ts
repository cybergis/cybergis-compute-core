import { hpcConfigMap, jupyterGlobusMap } from "../configs/config"
import BaseConnector from "./connectors/BaseConnector"
import DB from "./DB"
import * as fs from "fs"
import * as path from 'path'
import GlobusUtil from "./lib/GlobusUtil"
import FileUtil from './lib/FileUtil'
import { GlobusFile, hpcConfig } from "./types"
import Helper from "./Helper"
import { File } from "./models/File"

/** interface definition */
export class BaseFileUploader {
    public id: string

    public path: string

    public hpcName: string

    public hpcConfig: hpcConfig

    private _db: DB

    private _isComplete: boolean

    private _isFailed: boolean

    constructor(hpcName: string) {
        this.hpcName = hpcName
        this.hpcConfig = hpcConfigMap[hpcName]
        if (!this.hpcConfig) throw new Error(`cannot find hpcConfig with name ${hpcName}`)
        this.id = Helper.generateId()
        this._isComplete = false
        this._isFailed = false
        this._db = new DB()
    }

    async upload() {
        throw new Error('FileUploader upload not implemented')
    }

    isComplete() {
        return this._isComplete
    }

    isFailed() {
        return this._isComplete
    }

    // TODO: not interval
    initUploadManager(callback: Function) {


        const that = this



        const managerProcess = setInterval(async () => {
            [that._isComplete, that._isFailed] = await callback()
            if (that._isComplete) {
                clearInterval(managerProcess)
                if (!that._isFailed) {
                    const connection = await this._db.connect()
                    const fileRepo = connection.getRepository(File)
                    const file = new File()
                    file.id = this.id
                    file.path = this.path
                    file.hpc = this.hpcName
                    await fileRepo.save(file)
                }
            }
        }, 5 * 1000)
    }
}

export class GlobusFileUploader extends BaseFileUploader {
    private from: GlobusFile = {}

    private to: GlobusFile = {}

    private taskId: string

    constructor(from: GlobusFile, hpcName: string) {
        super(hpcName)
        const jupyterGlobus = jupyterGlobusMap[hpcName]
        if (!this.hpcConfig) throw new Error(`cannot find hpcConfig with name ${hpcName}`)
        if (!jupyterGlobus) throw new Error(`cannot find jupyterMap with name ${hpcName}`)

        this.path = path.join(jupyterGlobus.root_path, this.id)
        this.from = from
        this.to = {
            endpoint: jupyterGlobus.endpoint,
            path: this.path
        }
    }

    async upload() {
        this.taskId = await GlobusUtil.initTransfer(this.from, this.to, this.hpcConfig)
        this.initUploadManager(async () => {
            var isComplete = false
            var isFailed = false
            const status = await GlobusUtil.monitorTransfer(this.taskId, this.hpcConfig)
            if (status.includes('FAILED')) {
                isComplete = true
                isFailed = true
            }
            if (status.includes('SUCCEEDED')) {
                isComplete = true
            }
            return [isComplete, isFailed]
        })
    }
}

export class LocalFileUploader extends BaseFileUploader {
    private _connector: BaseConnector

    private _localPath: string

    constructor(localPath: string, hpcName: string) {
        super(hpcName)
        if (!fs.existsSync(localPath)) {
            throw new Error(`could not find folder under path ${localPath}`)
        }
        this._localPath = localPath
        this.path = path.join(this.hpcConfig.data_path, this.id)
        this._connector = new BaseConnector(hpcName)
    }

    async upload() {
        const from = await FileUtil.getZip(this._localPath)
        const to = this.path
        this.initUploadManager(async () => {
            try {
                await this._connector.upload(from, to, false)
                await FileUtil.removeZip(from)
                await FileUtil.removeFolder(this._localPath)
                return [true, false]
            } catch (e) {
                return [true, true]
            }
        })
    }
}