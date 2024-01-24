import DB from "./DB";
import { config } from "../configs/config";
import { Event } from "./models/Event";
import { Log } from "./models/Log";
import { Job } from "./models/Job";

/**
 * This class abstracts away the "emission" of signals via mutations to the database. 
 */
class Emitter {
  private db = new DB();


  /**
   * This function processes a event of a given type for a given job. A message is also associated with the event.
   *
   * @param {Job} job the job the event pertains to
   * @param {string} type the type of the event -- JOB_INIT | JOB_ENDED | JOB_FAILED
   * @param {string} message message associated with the event
   */
  async registerEvents(job: Job, type: string, message: string) {
    if (config.is_testing) console.log(`${job.id}: [event]`, type, message);

    const connection = await this.db.connect();
    const eventRepo = connection.getRepository(Event);
    const jobId = job.id;

    if (type === "JOB_INIT") {
      job.initializedAt = new Date();
      await connection
        .createQueryBuilder()
        .update(Job)
        .where("id = :id", { id: job.id })
        .set({ initializedAt: job.initializedAt })
        .execute();
    } else if (type === "JOB_ENDED" || type === "JOB_FAILED") {
      job.finishedAt = new Date();
      job.isFailed = type === "JOB_FAILED";
      await connection
        .createQueryBuilder()
        .update(Job)
        .where("id = :id", { id: job.id })
        .set({ finishedAt: job.finishedAt, isFailed: job.isFailed })
        .execute();
    }

    const event: Event = new Event();
    event.jobId = jobId;
    event.type = type;
    event.message = message;
    try {
      await eventRepo.save(event);
    } catch {}
  }

  /**
   * Handles any logs that are made during execution. 
   * 
   * @param job job the log pertains to
   * @param message content of the log
   */
  async registerLogs(job: Job, message: string) {
    if (config.is_testing) console.log(`${job.id}: [log]`, message);

    const connection = await this.db.connect();
    const logRepo = connection.getRepository(Log);

    const log: Log = new Log();
    log.jobId = job.id;
    log.message =
      message.length > 500
        ? message.substring(0, 500) + "...[download for full log]"
        : message;
    try {
      await logRepo.save(log);
    } catch {}
  }

  /**
   * Gets all events associated with a given job ordered in reverse chronological order of creation. 
   * 
   * @param {string} jobId id of job to request
   * @returns {Promise{Event[]}} list of events
    */
  async getEvents(jobId: string): Promise<Event[]> {
    const connection = await this.db.connect();
    return await connection
      .createQueryBuilder(Event, "event")
      .where("event.jobId = :jobId", { jobId: jobId })
      .orderBy("event.createdAt", "DESC")
      .getMany();
  }

  /**
   * Gets all logs associated with a given job in reverse chronological order of creation. 
   *
   * @param {string} jobId id of job to request
   * @return {Promise<Log[]>} list of logs
   */
  async getLogs(jobId: string): Promise<Log[]> {
    const connection = await this.db.connect();
    return await connection
      .createQueryBuilder(Log, "log")
      .where("log.jobId = :jobId", { jobId: jobId })
      .orderBy("log.createdAt", "DESC")
      .getMany();
  }
}

export default Emitter;
