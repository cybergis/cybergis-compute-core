import { ENOMEM } from "constants"

class Emitter {
    private events = {}

    register(jobID: string, type: string, message: string) {
        if (this.events[jobID] === undefined) {
            this.events[jobID] = []
        }
        this.events[jobID].push({
            type: type,
            message: message,
            at: new Date()
        })
    }

    check(jobID: string) {
        return this.events[jobID]
    }
}

export default Emitter