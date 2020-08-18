import Helper from "../Helper"
import SSH from "../SSH"
import { manifest, options } from "../types"
const config = require('../../config.json')
const { spawn } = require('child-process-async')

class BaseMaintainer {
    private _lock = false

    public isInit = false

    public isEnd = false

    private rawManifest: manifest = null

    public manifest = null

    protected events = []

    protected logs = []

    protected env = {}

    public downloadDir: string = undefined

    public allowedEnv = undefined

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
    }

    define() {
        //
    }

    async onInit() {
        //
    }

    async onMaintain() {

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

                var download = o.match(/download=\[[\s\S]*\]/g)
                if (download != null) {
                    download.forEach((v, i) => {
                        v = v.replace('download=[', '')
                        v = v.replace(/]$/g, '')
                        self.registerDownloadDir(v)
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

    registerDownloadDir(dir: string) {
        this.downloadDir = dir
    }

    emitEvent(type: string, message: string) {
        if (type === 'JOB_ENDED' || type === 'JOB_FAILED') {
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

    getJobID() {
        return this.manifest.id
    }

    emitLog(message: string) {
        this.logs.push(message)
    }

    async init() {
        if (!this._lock) {
            this._lock = true
            await this.onInit()
            this._lock = false
        }
    }

    async maintain() {
        if (!this._lock) {
            this._lock = true
            await this.onMaintain()
            this._lock = false
        }
    }

    async connect(commands: Array<any>, options: options = {}) {
        var ssh = new SSH(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd)
        await ssh.connect(this.env)
        var out = await ssh.exec(commands, options, this)
        return out
    }

    async upload(from, to, isDirectory = false, fileNameValidation = null) {
        var ssh = new SSH(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd)
        await ssh.connect(this.env)

        if (isDirectory) {
            var out = await ssh.putDirectory(from, to, fileNameValidation)
            return out
        } else {
            await ssh.putFile(from, to)
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