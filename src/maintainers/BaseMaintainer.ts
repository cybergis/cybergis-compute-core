import Helper from "../Helper"
import SSH from "../SSH"
import { manifest, options } from "../types"
import File from '../File'
const config = require('../../config.json')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child-process-async')

class BaseMaintainer {
    /** mutex **/
    private _lock = false

    /** flags **/
    public isInit = false

    public isEnd = false

    /** data & states **/
    protected events = []

    protected logs = []

    protected uploadedPath = undefined

    public downloadedPath = undefined

    protected lifeCycleState = {
        initCounter: 0,
        initThresholdInCount: 3,
        createdAt: null,
        maintainThresholdInHours: 0.0001
    }

    /** classes **/
    protected file = new File()

    public SSH: SSH

    /** configs **/
    protected env = {}

    private rawManifest: manifest = null

    public manifest = null // secure manifest with no credentials

    public allowedEnv = undefined

    public removeFileAfterJobFinished = true

    constructor(manifest: manifest) {
        this.define()

        if (this.allowedEnv === undefined) {
            manifest.env = {}
        }

        var env = {}

        for (var i in this.allowedEnv) {
            var val = manifest.env[i]
            if (val != undefined) {
                var type = this.allowedEnv[i]
                if (Array.isArray(type)) {
                    if (type.includes(val)) {
                        env[i] = val
                    }
                } else if (typeof val === type) {
                    env[i] = val
                }
            }
        }

        this.env = env
        this.rawManifest = manifest
        this.manifest = Helper.hideCredFromManifest(manifest)
        this.SSH = new SSH(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd, this)
    }

    /** lifecycle interfaces **/
    define() {
        // implement it in children class
    }

    async onInit() {
        // implement it in children class
    }

    async onMaintain() {
        // implement it in children class
    }


    /** executors **/
    async runBash(pipeline: Array<any>, options: options = {}) {
        await this.SSH.connect(this.env)
        var out = await this.SSH.exec(pipeline, options)
        return out
    }

    async runPython(file: string, args = []) {
        args.unshift(`${__dirname}/python/${file}`)
        const child = spawn('python3', args)

        var out = {}
        var self = this

        child.stdout.on('data', function (result) {
            var stdout = Buffer.from(result, 'utf-8').toString()

            if (config.isTesting) {
                console.log(stdout)
            }

            var parsedStdout = stdout.split('@')

            for (var i in parsedStdout) {
                var o = parsedStdout[i]
                var log = o.match(/log=\[[\s\S]*\]/g)
                if (log != null) {
                    log.forEach((v, i) => {
                        v = v.replace('log=[', '')
                        v = v.replace(/]$/g, '')
                        self.emitLog(v)
                    })
                }

                var event = o.match(/event=\[[\s\S]*:[\s\S]*\]/g)
                if (event != null) {
                    event.forEach((v, i) => {
                        v = v.replace('event=[', '')
                        v = v.replace(/]$/g, '')
                        var e = v.split(':')
                        self.emitEvent(e[0], e[1])
                    })
                }

                var variable = o.match(/var=\[[\s\S]*:[\s\S]*\]/g)
                if (variable != null) {
                    variable.forEach((v, i) => {
                        v = v.replace('var=[', '')
                        v = v.replace(/]$/g, '')
                        var e = v.split(':')
                        out[e[0]] = e[1]
                    })
                }

                var download = o.match(/custom_downloaded_path=\[[\s\S]*\]/g)
                if (download != null) {
                    download.forEach((v, i) => {
                        v = v.replace('custom_downloaded_path=[', '')
                        v = v.replace(/]$/g, '')
                        self.registerCustomDownloadedPath(v)
                    })
                }
            }
        })

        const { stdout, stderr, exitCode } = await child

        if (config.isTesting) {
            console.log(stderr.toString())
        }

        return out
    }

    /** file operations **/
    async upload(destinationRootPath: string) {
        var sourcePath = __dirname + '/../../data/upload/' + this.rawManifest.uid + '/' + this.rawManifest.file

        if (!fs.existsSync(sourcePath)) {
            throw new Error('file path ' + sourcePath + ' does not exist')
        }

        await this.SSH.connect(this.env)
        var destinationPath = path.join(destinationRootPath, this.rawManifest.file)
        var uploadResult = await this.SSH.putDirectory(sourcePath, destinationPath)
        var uploadCounter = 1
        while (uploadResult.failed.length > 0 && uploadCounter <= 3) {
            // re-upload three times
            uploadResult = await this.SSH.putDirectory(sourcePath, destinationPath)
            uploadCounter += 1
        }

        if (uploadResult.failed.length > 0) {
            this.emitEvent('FILES_UPLOAD_FAIL', 'upload failed after three times of attempt.')
            throw new Error('upload failed after three times of attempt. Failed files: ' + JSON.stringify(uploadResult.failed))
        }

        this.emitEvent('FILES_UPLOADED', 'files uploaded to destination.')

        this.uploadedPath = destinationPath

        return destinationPath
    }

    async download(sourceRootPath: string) {
        var destinationPath = __dirname + '/../../data/download/'
        var fileName = this.rawManifest.id + '.tar'

        await this.SSH.connect(this.env)

        var sourcePath = path.join(sourceRootPath, this.rawManifest.file)

        await this.SSH.getDirectoryZipped(sourcePath, destinationPath, fileName)

        var uploadCounter = 1
        var tarFilePath = path.join(destinationPath, fileName)
        while (!fs.existsSync(tarFilePath) && uploadCounter <= 3) {
            await this.SSH.getDirectoryZipped(sourcePath, fileName)
        }

        if (!fs.existsSync(tarFilePath)) {
            this.emitEvent('FILES_DOWNLOAD_FAIL', 'download failed after three times of attempt.')
            throw new Error('download failed after three times of attempt.')
        }

        this.emitEvent('FILES_DOWNLOADED', 'files downloaded to from destination.')

        this.downloadedPath = tarFilePath

        return tarFilePath
    }

    registerCustomDownloadedPath(downloadedPath: string) {
        this.downloadedPath = downloadedPath
    }

    async removeUploadedFile() {
        if (this.uploadedPath != undefined) {
            this.runBash(['rm -rf ' + this.uploadedPath])
        }
    }

    /** helpers **/
    async getRemoteHomePath(): Promise<string> {
        await this.SSH.connect(this.env)
        return await this.SSH.getRemoteHomePath()
    }

    injectRuntimeFlagsToFile(filePath: string, lang: string) {
        var supportedLangs = ['python']
        lang = lang.toLowerCase()

        if (!supportedLangs.includes(lang)) {
            throw new Error('language not supported')
        }

        var sourcePath = __dirname + '/../../data/upload/' + this.rawManifest.uid + '/' + this.rawManifest.file

        if (!fs.existsSync(sourcePath)) {
            throw new Error('file path ' + sourcePath + ' does not exist')
        }

        filePath = path.join(sourcePath, filePath)

        if (!fs.existsSync(filePath)) {
            throw new Error('file path ' + filePath + ' does not exist')
        }

        var flags = {
            // only end for now
            end: '@flag=[SCRIPT_ENDED:script ' + filePath + ' job [' + this.manifest.id + '] finished]'
        }

        for (var i in flags) {
            if (lang == 'python') {
                flags[i] = 'print("' + flags[i] + '")'
            }
        }
        
        fs.appendFileSync(filePath, "\n" + flags.end)
    }

    /** emitters **/
    emitEvent(type: string, message: string) {
        if (type === 'JOB_ENDED' || type === 'JOB_FAILED') {
            if (this.removeFileAfterJobFinished) {
                this.removeUploadedFile()
            }
            this.isEnd = true
        }

        if (type === 'JOB_INITIALIZED') {
            this.isInit = true
        }

        this.events.push({
            type: type,
            message: message
        })
    }

    emitLog(message: string) {
        this.logs.push(message)
    }


    /** getters **/
    getJobID() {
        return this.manifest.id
    }

    /** supervisor interfaces **/
    async init() {
        if (!this._lock) {
            this._lock = true

            if (this.lifeCycleState.initCounter >= this.lifeCycleState.initThresholdInCount) {
                this.emitEvent('JOB_FAILED', 'initialization counter exceeds ' + this.lifeCycleState.initThresholdInCount + ' counts')
            } else {
                await this.onInit()
                this.lifeCycleState.initCounter++
            }

            this._lock = false
        }
    }

    async maintain() {
        if (!this._lock) {
            this._lock = true

            if (this.lifeCycleState.createdAt === null) {
                this.lifeCycleState.createdAt = Date.now()
            }

            if (((this.lifeCycleState.createdAt - Date.now()) / (1000 * 60 * 60)) >= this.lifeCycleState.maintainThresholdInHours) {
                this.emitEvent('JOB_FAILED', 'maintain time exceeds ' + this.lifeCycleState.maintainThresholdInHours + ' hours')
            } else {
                await this.onMaintain()
            }

            this._lock = false
        }
    }

    dumpEvents() {
        var events = this.events
        this.events = []
        return events
    }

    dumpLogs() {
        var logs = this.logs
        this.logs = []
        return logs
    }
}

export default BaseMaintainer