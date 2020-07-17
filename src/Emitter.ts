import { ENOMEM } from "constants"

class Emitter {
    private events = {}

    private logs = {}

    registerEvents(jobID: string, type: string, message: string) {
        if (this.events[jobID] === undefined) {
            this.events[jobID] = []
        }
        this.events[jobID].push({
            type: type,
            message: message,
            at: new Date()
        })
        console.log(type, message)
    }

    registerLogs(jobID: string, message: string) {
        if (this.logs[jobID] === undefined) {
            this.logs[jobID] = []
        }
        this.logs[jobID].push({
            message: message,
            at: new Date()
        })
    }

    status(jobID: string) {
        return {
            events: this.events[jobID],
            logs: this.logs[jobID]
        }
    }
}

export default Emitter