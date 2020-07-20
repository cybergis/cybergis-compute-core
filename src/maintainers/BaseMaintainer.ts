import Helper from "../Helper"
import SSH from "../SSH"
import { manifest, options } from "../types"

class BaseMaintainer {
    private _lock = false

    public isInit = false

    public isEnd = false

    private rawManifest: manifest = null

    protected manifest = null

    protected events = []

    protected logs = []

    protected env = {}

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

    emitEvent(type: string, message: string) {
        if (type === 'JOB_ENDED') {
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
        var out = await ssh.exec(commands, options)
        return out
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