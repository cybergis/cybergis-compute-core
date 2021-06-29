import DB from './DB'
import { config } from '../configs/config'
import { Event } from './models/Event'
import { Log } from './models/Log'
import { Job } from './models/Job'

class Emitter {
    private db = new DB()

    async registerEvents(job: Job, type: string, message: string) {
        if (config.is_testing) console.log(`${job.id}: [event]`, type, message)
        var connection = await this.db.connect()
        var eventRepo = connection.getRepository(Event)
        var jobId = job.id

        var updateJob = false
        if (type === 'JOB_INIT') {
            updateJob = true
            job.initializedAt = new Date()
        } else if (type == 'JOB_ENDED' || type === 'JOB_FAILED') {
            updateJob = true
            job.finishedAt = new Date()
            job.isFailed = type === 'JOB_FAILED'
        }
        if (updateJob) {
            var jobRepo = connection.getRepository(Job)
            jobRepo.save(job)
        }

        var event: Event = new Event()
        event.jobId = jobId
        event.type = type
        event.message = message
        try { await eventRepo.insert(event) } catch {}
    }

    async registerLogs(job: Job, message: string) {
        if (config.is_testing) console.log(`${job.id}: [log]`, message)
        var connection = await this.db.connect()
        var logRepo = connection.getRepository(Log)

        var log: Log = new Log()
        log.jobId = job.id
        log.message = message.substring(0,50)
        await logRepo.save(log)
    }

    async getEvents(jobId: string): Promise<Event[]> {
        var connection = await this.db.connect()
        return await connection.createQueryBuilder(Event, 'event')
            .where('event.jobId = :jobId', { jobId: jobId })
            .orderBy('event.createdAt', 'DESC')
            .getMany()
    }

    async getLogs(jobId: string): Promise<Log[]> {
        var connection = await this.db.connect()
        return await connection.createQueryBuilder(Log, 'log')
            .where('log.jobId = :jobId', { jobId: jobId })
            .orderBy('log.createdAt', 'DESC')
            .getMany()
    }
}

export default Emitter