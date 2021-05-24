import Helper from "./Helper"
import { FileStructureError, FileNotExistError, NotImplementedError } from './errors'
import * as fs from 'fs'
import * as path from 'path'
import { config } from '../configs/config'
const rimraf = require("rimraf")
const unzipper = require('unzipper')
const archiver = require('archiver')

type fileConfig = {
    ignore?: Array<string>,
    must_have?: Array<string>,
    ignore_everything_except_must_have?: boolean
}

type fileTypes = 'local'

export class FileSystem {
    createClearLocalCacheProcess() {
        var cachePath = config.local_file_system.cache_path
        setInterval(function () {
            try {
                fs.readdir(cachePath, function (err, files) {
                    files.forEach(function (file, index) {
                        if (file != '.gitkeep') {
                            fs.stat(path.join(cachePath, file), function (err, stat) {
                                var endTime, now;
                                if (err) return console.error(err)
                                now = new Date().getTime()
                                endTime = new Date(stat.ctime).getTime() + 3600000
                                if (now > endTime) return rimraf(path.join(cachePath, file), (err) => {})
                            })
                        }
                    })
                })
            } catch {}
        }, 60 * 60 * 1000)
    }

    getFileByURL(url: string): BaseFolder {
        var u = url.split('://')
        return this.getFile(u[0], u[1])
    }

    getFile(type: string, id: string): BaseFolder {
        if (type == 'local') {
            return new LocalFolder(id)
        }
    }

    getLocalFolder(id: string): LocalFolder {
        return new LocalFolder(id)
    }

    getLocalFolderByURL(url: string): LocalFolder {
        var u = url.split('://')
        if (u[0] == 'local') return this.getLocalFolder(u[1])
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

    constructor(type: fileTypes) {
        this.type = type
    }

    validate() {
        throw new NotImplementedError('validate not implemented')
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
    }

    isZipped(): boolean {
        return fs.existsSync(this.path + '.zip')
    }

    getURL() {
        return `${this.type}://${this.id}`
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
                    var stream = fs.createWriteStream(path.join(that.path, entryParentPath, entryName), { flags: 'wx', encoding: 'utf-8', mode: 0o755 })
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
