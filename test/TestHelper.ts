import { Event, Job, Log } from "../src/models";
import dataSource from "../src/utils/DB";

export default class TestHelper {
  /**
   * 
   * @param id id of the job to create
   * @param userId user that created the job
   * @param secretToken  unused
   * @param maintainer maintainer for the job
   * @param hpc hpc that the job is running on
   * @returns the resulting job object
   */
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

  /**
   *
   * @param job job this event relates to
   * @param type type of event
   * @param message message of the event
   * @returns the created event
   */
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

  /**
   *
   * @param job job this log relates to
   * @param message message of teh log
   * @returns the created log
   */
  static async createLog(job: Job, message: string): Promise<Log> {
    const logRepository = dataSource.getRepository(Log);
    const log = new Log();
    log.job = job;
    log.jobId = job.id;
    log.message = message;
    return await logRepository.save(log);
  }
}
