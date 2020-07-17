import Helper from "../Helper"
import SSH from "../SSH"
import { manifest, options } from "../types"

class BaseMaintainer {
    public isInit = false

    public isEnd = false

    private rawManifest: manifest = null

    protected manifest: manifest = null

    protected events = []

    protected logs = []

    constructor(manifest: manifest) {
        this.rawManifest = manifest
        this.manifest = Helper.hideCredFromManifest(manifest)
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

    async connect(commands: Array<any>, options: options = {}) {
        var ssh = new SSH(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd)
        await ssh.connect()
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