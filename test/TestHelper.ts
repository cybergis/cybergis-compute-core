import DB from "../src/DB";
import { Event } from "../src/models/Event";
import { Log } from "../src/models/Log";
import { Job } from "../src/models/Job";

export default class TestHelper {
  static async createJob(
    id: string,
    jupyterhubApiToken: string,
    maintainer: string,
    hpc: string,
    userId: string,
    password: string
  ): Promise<Job> {
    const db = new DB();
    const connection = await db.connect();
    const jobRepository = connection.getRepository(Job);
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
    const db = new DB();
    const connection = await db.connect();
    const eventRepository = connection.getRepository(Event);
    const event = new Event();
    event.job = job;
    event.jobId = job.id;
    event.type = type;
    event.message = message;
    return await eventRepository.save(event);
  }

  static async createLog(job: Job, message: string): Promise<Log> {
    const db = new DB();
    const connection = await db.connect();
    const logRepository = connection.getRepository(Log);
    const log = new Log();
    log.job = job;
    log.jobId = job.id;
    log.message = message;
    return await logRepository.save(log);
  }
}
