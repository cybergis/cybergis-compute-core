import { Event } from "../src/models/Event";
import { Job } from "../src/models/Job";
import { Log } from "../src/models/Log";
import dataSource from "../src/utils/DB";

export default class TestHelper {
  static async createJob(
    id: string,
    userId: string,
    secretToken: string,
    maintainer: string,
    hpc: string
  ): Promise<Job> {
    const jobRepository = dataSource.getRepository(Job);
    const job = new Job();
    job.id = id;
    job.userId = userId;
    job.maintainer = maintainer;
    job.hpc = hpc;
    return await jobRepository.save(job);
  }

  static async createEvent(
    job: Job,
    type: string,
    message: string
  ): Promise<Event> {
    const eventRepository = dataSource.getRepository(Event);
    const event = new Event();
    event.job = job;
    event.jobId = job.id;
    event.type = type;
    event.message = message;
    return await eventRepository.save(event);
  }

  static async createLog(job: Job, message: string): Promise<Log> {
    const logRepository = dataSource.getRepository(Log);
    const log = new Log();
    log.job = job;
    log.jobId = job.id;
    log.message = message;
    return await logRepository.save(log);
  }
}
