import Queue from "./Queue"
import Emitter from "./Emitter"
import { manifest } from './types'

class Supervisor {

    private jobPoolCapacity = 5

    private jobPool = []

    private queue = new Queue()

    private emitter = new Emitter()

    private worker = null

    private workerTimePeriodInSeconds = 1

    constructor() {
        var self = this

        this.worker = setInterval(function () {
            if (self.jobPool.length > 0) {
                //
            }

            while (self.jobPool.length < this.jobPoolCapacity && !this.queue.isEmpty()) {
                var job = self.queue.shift()
                job.id = self._generateJobID()
                self.jobPool.push(job)
                self.emitter.register(job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization')
            }
        }, this.workerTimePeriodInSeconds * 1000)
    }

    add(manifest: manifest) {
        this.queue.push(manifest)
    }

    private _generateJobID(): string {
        return ''
    }

}

export default Supervisor