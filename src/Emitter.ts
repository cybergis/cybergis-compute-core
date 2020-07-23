class Emitter {
    private events = {}

    private logs = {}

    registerEvents(uid: number, jobID: string, type: string, message: string) {
        if (this.events[uid] === undefined) {
            this.events[uid] = {}
        }

        if (this.events[uid][jobID] === undefined) {
            this.events[uid][jobID] = []
        }
        this.events[uid][jobID].push({
            type: type,
            message: message,
            at: new Date()
        })
    }

    registerLogs(uid: number, jobID: string, message: string) {
        if (this.logs[uid] === undefined) {
            this.logs[uid]  = {}
        }

        if (this.logs[uid][jobID] === undefined) {
            this.logs[uid][jobID] = []
        }
        this.logs[uid][jobID].push({
            message: message,
            at: new Date()
        })
    }

    status(uid: number, jobID: string = null) {
        if (jobID === null) {
            var usrEvents = {}
            var usrLogs = {}

            if (this.events[uid] != undefined) {
                usrEvents = this.events[uid]
            }

            if (this.logs[uid] != undefined) {
                usrLogs = this.logs[uid]
            }

            return {
                events: usrEvents,
                logs: usrLogs
            }
        } else {
            var events = []
            var logs = []

            if (this.events[uid] != undefined) {
                if (this.events[uid][jobID] != undefined) {
                    events = this.events[uid][jobID]
                }
            }

            if (this.logs[uid] != undefined) {
                if (this.logs[uid][jobID] != undefined) {
                    logs = this.logs[uid][jobID]
                }
            }

            return {
                events: events,
                logs: logs
            }
        }
    }
}

export default Emitter