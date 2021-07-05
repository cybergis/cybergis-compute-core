import Helper from "./Helper"
import { FileStructureError, FileNotExistError, NotImplementedError } from './errors'
import * as fs from 'fs'
import * as path from 'path'
import { gitConfig, executableManifest } from './types'
import { config, gitConfigMap } from '../configs/config'
import { exec } from 'child-process-async'
import { stderr, stdout } from "process"
const rimraf = require("rimraf")
const unzipper = require('unzipper')
const archiver = require('archiver')

type fileConfig = {
    ignore?: Array<string>,
    must_have?: Array<string>,
    ignore_everything_except_must_have?: boolean
}

type fileTypes = 'local' | 'git'

export class FileSystem {
    createClearLocalCacheProcess() {
        var cachePath = config.local_file_system.cache_path
        setInterval(function () {
            try {
                fs.readdir(cachePath, function (err, files) {
                    if (!files) return // hack
                    files.forEach(function (file, index) {
                        if (file != '.gitkeep') {
                            fs.stat(path.join(cachePath, file), function (err, stat) {
                                var endTime, now;
                                if (err) return console.error(err)
                                now = () => 'CURRENT_TIMESTAMP'
                                endTime = new Date(stat.ctime).getTime() + 3600000
                                if (now > endTime) return rimraf(path.join(cachePath, file), (err) => {})
                            })
                        }
                    })
                })
            } catch {}
        }, 60 * 60 * 1000)
    }

    getFolderByURL(url: string, onlyAllow: string | Array<string> = null): BaseFolder {
        var u = url.split('://')
        if (onlyAllow) {
            if (typeof onlyAllow == 'string') {
                if (u[0] != onlyAllow) throw new Error(`file protocol ${u[0]} is not allowed`)
            } else {
                if (!onlyAllow.includes(u[0])) throw new Error(`file protocol ${u[0]} is not allowed`)
            }
        }
        return this.getFolder(u[0], u[1])
    }

    getFolder(type: string, id: string): BaseFolder {
        if (type == 'local') return new LocalFolder(id)
        if (type == 'git') return new GitFolder(id)
        throw new Error(`cannot find file ${type}://${id}`)
    }

    getLocalFolder(id: string): LocalFolder {
        return new LocalFolder(id)
    }

    getGitFolder(id: string): GitFolder {
        return new GitFolder(id)
    }

    createLocalFolder(providedFileConfig: fileConfig = {}): LocalFolder {
        var id = this._generateID()
        var filePath = path.join(config.local_file_system.root_path, id)

        while (fs.existsSync(filePath)) {
            id = this._generateID()
            filePath = path.join(config.local_file_system.root_path, id)
        }

        fs.mkdirSync(filePath)
        if (providedFileConfig != {}) {
            var infoJSON: string = JSON.stringify({config: providedFileConfig})
            fs.writeFileSync(path.join(filePath, '.file_config.json'), infoJSON)
        }
        return new LocalFolder(id)
    }

    private _generateID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }
}

export class BaseFolder {
    public type: fileTypes

    public url: string

    public path: string

    constructor(type: fileTypes) {
        this.type = type
    }

    validate() {
        // empty interface
    }

    getURL() {
        return this.url
    }

    isZipped(): boolean {
        return fs.existsSync(this.path + '.zip')
    }

    async getZip(): Promise<string> {
        if (!this.path) throw new Error('getZip operation is not supported')

        if (this.isZipped()) return this.path + '.zip'

        var output = fs.createWriteStream(this.path + '.zip')
        var archive = archiver('zip', { zlib: { level: 9 } })

        await new Promise((resolve, reject) => {
            output.on('open', (fd) => { 
                archive.pipe(output)
                archive.directory(this.path, false)
                archive.finalize()
             })
            archive.on('error', (err) => { reject(err) })
            output.on('close', () => { resolve(null) })
            output.on('end', () => { resolve(null) })
        })

        return this.path + '.zip'
    }
}

export class GitFolder extends BaseFolder {
    public config: gitConfig

    public executableManifest: executableManifest

    constructor(id: string) {
        super('git')
        var gitConfig = gitConfigMap[id]
        if (!gitConfig) throw new FileNotExistError(`file ID ${id} not exist`)
        this.config = gitConfig
        this.path = path.join(config.local_file_system.root_path, id)
        this.url = `${this.type}://${gitConfig.url}`
    }

    async init() {
        try {
            if (!fs.existsSync(this.path)) {
                fs.mkdirSync(this.path)
                await exec(`cd ${this.path} && git clone ${this.config.url} ${this.path}`)
            }

            if (this.config.sha) {
                var { stdout, stderr } = await exec(`git rev-parse HEAD`)
                var sha = stdout.trim()
                if (sha != this.config.sha) {
                    rimraf.sync(this.path)
                    fs.mkdirSync(this.path)
                    await exec(`cd ${this.path} && git clone ${this.config.url} ${this.path}`)
                    await exec(`cd ${this.path} && git checkout ${this.config.sha}`)
                }
            } else {
                rimraf.sync(this.path)
                fs.mkdirSync(this.path)
                await exec(`cd ${this.path} && git clone ${this.config.url} ${this.path}`)
            }

            const rawExecutableManifest = require(path.join(this.path, 'manifest.json'))
            this.executableManifest = JSON.parse(JSON.stringify(rawExecutableManifest))
        } catch (e) {
            throw new Error(`initialization failed with error: ${e.toString()}`)
        }
    }

    async getExecutableManifest(): Promise<executableManifest> {
        await this.init()
        return this.executableManifest
    }

    async getZip(): Promise<string> {
        await this.init()
        return await super.getZip()
    }
}

export class LocalFolder extends BaseFolder {
    public id: string

    public path: string

    public config: fileConfig

    constructor(id: string) {
        super('local')

        const folderPath = path.join(config.local_file_system.root_path, id)
        if (!fs.existsSync(folderPath)) throw new FileNotExistError(`file ID ${id} not exist`)

        this.id = id
        this.path = folderPath
        this.config = this._getConfig()
        this.url = `${this.type}://${this.id}`
    }

    validate() {
        const files = fs.readdirSync(this.path)
        var mustHaveFiles = []

        for (var i in files) {
            var file = files[i]
            if (this.config.must_have.includes(file)) mustHaveFiles.push(file)
        }

        for (var i in this.config.must_have) {
            var mustHave = this.config.must_have[i]
            if (!mustHaveFiles.includes(mustHave)) throw new FileStructureError(`file [${file}] must be included`)   
        }
    }

    async getZip(): Promise<string> {
        if (this.isZipped()) return this.path + '.zip'
        return await super.getZip()
    }

    removeZip() {
        if (this.isZipped()) {
            if (Helper.fileModifiedDate(this.path) > Helper.fileModifiedDate(this.path + '.zip'))
                fs.unlinkSync(this.path + '.zip')
        }
    }

    async putFileFromZip(zipFilePath: string) {
        var zip = fs.createReadStream(zipFilePath).pipe(unzipper.Parse({ forceStream: true }))

        for await (const entry of zip) {
            const entryPath = entry.path
            const entryName = path.basename(entryPath)
            const entryRoot = entryPath.split('/')[0]
            const entryParentPath = path.dirname(entryPath)
            const type = entry.type
            const that = this

            const writeFile = () => {
                if (type === 'File' && !that.config.ignore.includes(entryName)) {
                    var p = path.join(that.path, entryParentPath, entryName)
                    if (fs.existsSync(p)) fs.unlinkSync(p)
                    var stream = fs.createWriteStream(p, { flags: 'wx', encoding: 'utf-8', mode: 0o755 })
                    stream.on('open', (fd) => { entry.pipe(stream) })
                }
            }

            const createDir = async () => {
                if (!fs.existsSync(path.join(that.path, entryParentPath))) {
                    await fs.promises.mkdir(path.join(that.path, entryParentPath), { recursive: true })
                }
            }

            if (entryRoot != undefined) {
                if (this.config.ignore.includes(entryRoot)) {
                    entry.autodrain()
                } else if (this.config.ignore_everything_except_must_have) {
                    if (this.config.must_have.includes(entryRoot)) {
                        await createDir(); writeFile()
                    } else {
                        entry.autodrain()
                    }
                } else {
                    await createDir(); writeFile()
                }
            } else {
                if (this.config.ignore.includes(entryRoot)) {
                    entry.autodrain()
                } else if (this.config.ignore_everything_except_must_have) {
                    if (this.config.must_have.includes(entryName)) {
                        await createDir(); writeFile()
                    } else {
                        entry.autodrain()
                    }
                } else {
                    await createDir(); writeFile()
                }
            }
        }

        this.removeZip()
    }

    putFileFromTemplate(template: string, replacements: any, filePath: string) {
        for (var key in replacements) {
            var value = replacements[key]
            template = template.replace(`{{${key}}}`, value)
        }
        this.putFileFromString(template, filePath)
    }

    putFileFromString(content: string, filePath: string) {
        const fileName = path.basename(filePath)
        filePath = path.join(this.path, filePath)
        const fileParentPath = path.dirname(filePath)
        if (this.config.ignore_everything_except_must_have && !this.config.must_have.includes(fileName)) return
        if (!this.config.ignore_everything_except_must_have && this.config.ignore.includes(fileName)) return

        if (!fs.existsSync(fileParentPath)) fs.mkdirSync(fileParentPath, { recursive: true })

        fs.writeFileSync(filePath, content, {
            mode: 0o755
        })

        this.removeZip()
    }

    putFolder(folderPath: string) {
        folderPath = path.join(this.path, folderPath)
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })
    }

    private _getConfig(): fileConfig  {
        const fileConfig = {
            ignore: ['.placeholder', '.DS_Store', '.file_config.json'],
            must_have: [],
            ignore_everything_except_must_have: false
        }

        var configPath = path.join(this.path, '.file_config.json')
        if (fs.existsSync(configPath)) {
            var providedFileConfig = require(configPath)
            if (providedFileConfig != undefined) {
                if (providedFileConfig.ignore != undefined) fileConfig.ignore.concat(providedFileConfig.ignore)
                if (providedFileConfig.must_have != undefined) fileConfig.must_have = providedFileConfig.must_have
                if (providedFileConfig.ignore_everything_except_must_have != undefined) {
                    fileConfig.ignore_everything_except_must_have = providedFileConfig.ignore_everything_except_must_have
                }
            }
        }

        return fileConfig
    }

    chmod(filePath: string, mode: string) {
        fs.chmodSync(path.join(this.path, filePath), mode)
    }
}
