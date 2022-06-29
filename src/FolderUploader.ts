import { hpcConfigMap, jupyterGlobusMap } from "../configs/config"
import BaseConnector from "./connectors/BaseConnector"
import DB from "./DB"
import * as fs from "fs"
import * as path from 'path'
import GlobusUtil from "./lib/GlobusUtil"
import FolderUtil from './lib/FolderUtil'
import { GitFolder, GlobusFolder, hpcConfig, LocalFolder, NeedUploadFolder } from "./types"
import Helper from "./Helper"
import { Folder } from "./models/Folder"
import { Git } from "./models/Git"
import GitUtil from "./lib/GitUtil"
import SlurmConnector from "./connectors/SlurmConnector"
import SingularityConnector from "./connectors/SingularityConnector"

type Connector = BaseConnector | SlurmConnector | SingularityConnector

export class BaseFolderUploader {
    public id: string

    public path: string

    public hpcName: string

    public userId: string

    public hpcConfig: hpcConfig

    public isComplete: boolean

    public isFailed: boolean

    protected db: DB

    constructor(hpcName: string, userId: string) {
        this.hpcName = hpcName
        this.userId = userId
        this.hpcConfig = hpcConfigMap[hpcName]
        if (!this.hpcConfig) throw new Error(`cannot find hpcConfig with name ${hpcName}`)
        this.id = Helper.generateId()
        this.isComplete = false
        this.isFailed = false
        this.db = new DB()
    }

    async upload() {
        throw new Error('FolderUploader upload not implemented')
    }

    protected async register() {
        const connection = await this.db.connect()
        const folder = new Folder()
        folder.id = this.id
        folder.path = this.path
        folder.hpc = this.hpcName
        folder.userId = this.userId
        await connection.getRepository(Folder).save(folder)
    }
}

export class EmptyFolderUploader extends BaseFolderUploader {
    protected connector: Connector

    constructor(hpcName: string, userId: string, connector: Connector) {
        super(hpcName, userId)
        this.connector = connector
    }

    async upload() {
        this.path = path.join(this.hpcConfig.root_path, this.id)
        await this.connector.mkdir(this.path, {}, true)
        await this.register()
        this.isComplete = true
    }
}

export class GlobusFolderUploader extends BaseFolderUploader {
    private from: GlobusFolder = {}

    private to: GlobusFolder = {}

    private taskId: string

    private managerProcess

    constructor(from: GlobusFolder, hpcName: string, userId: string) {
        super(hpcName, userId)
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
        this.managerProcess = setInterval(async () => {
            var isComplete = this.isComplete
            var isFailed = this.isFailed
            const status = await GlobusUtil.monitorTransfer(this.taskId, this.hpcConfig)
            if (status.includes('FAILED')) {
                isComplete = true
                isFailed = true
            }
            if (status.includes('SUCCEEDED')) {
                isComplete = true
            }
            if (isComplete) {
                clearInterval(this.managerProcess)
                if (!isFailed) {
                    await this.register()
                }
            }
            this.isComplete = isComplete
            this.isFailed = isFailed
        }, 2 * 1000)
    }
}

export class LocalFolderUploader extends BaseFolderUploader {
    protected connector: Connector

    protected localPath: string

    constructor(from: LocalFolder, hpcName: string, userId: string, connector: Connector = null) {
        super(hpcName, userId)
        this.localPath = from.localPath
        this.path = path.join(this.hpcConfig.root_path, this.id)
        this.connector = connector ?? new BaseConnector(hpcName)
    }

    async upload() {
        if (!fs.existsSync(this.localPath)) {
            throw new Error(`could not find folder under path ${this.localPath}`)
        }
        const from = await FolderUtil.getZip(this.localPath)
        const to = this.path
        await this.connector.upload(from, to, false)
        await FolderUtil.removeZip(from)
        await this.register()
        this.isComplete = true
    }
}

export class GitFolderUploader extends LocalFolderUploader {
    private gitId: string

    private git: Git

    constructor(from: GitFolder, hpcName: string, userId: string, connector: Connector = null) {
        const localPath = GitUtil.getLocalPath(from.gitId)
        super({ localPath }, hpcName, userId, connector)
        this.gitId = from.gitId
    }

    async upload() {
        const connection = await this.db.connect()
        const gitRepo = connection.getRepository(Git)
        this.git = await gitRepo.findOne(this.gitId)
        if (!this.git) {
            throw new Error(`cannot find git repo with id ${this.gitId}`)
        }
        await GitUtil.refreshGit(this.git)
        await super.upload()
    }
}

export class FolderUploaderHelper {
    static async upload(from:  NeedUploadFolder, hpcName: string, userId: string, connector: Connector = null) {
        if (!from.type) throw new Error('invalid local file format')
        var uploader: BaseFolderUploader
        switch (from.type) {
            case 'git':
                uploader = new GitFolderUploader(from, hpcName, userId, connector)
                await uploader.upload()
                break
            case 'local':
                uploader = new LocalFolderUploader(from, hpcName, userId, connector)
                await uploader.upload()
                break
            case 'globus':
                uploader = new GlobusFolderUploader(from, hpcName, userId)
                await uploader.upload()
                break
            case 'empty':
                uploader = new EmptyFolderUploader(hpcName, userId, connector)
                await uploader.upload()
                break
            default:
                throw new Error('undefined file type ' + from.type)
        }
        return uploader
    }

    static async waitUntilComplete(uploader: BaseFolderUploader): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const intervalThread = setInterval(() => {
                if (uploader.isComplete) {
                    clearInterval(intervalThread)
                    resolve(true)
                }
            }, 2 * 1000)
        })
    }
}