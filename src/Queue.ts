import redis = require("redis");
import { promisify } from "util";
import { config } from "../configs/config";
import DB from "./DB";
import { Job } from "./models/Job";
import { CredentialManager } from "./SSHCredentialGuard";
import { PushFunction, ShiftFunction, PeekFunction, LengthFunction } from "./types";

/**
 * This class is used to represent queues of jobs waiting to be executed. 
 */
class Queue {
  private name;

  private redis_functions = {
    push: null as PushFunction | null,
    shift: null as ShiftFunction | null,
    peek: null as PeekFunction | null,
    length: null as LengthFunction | null,
  };

  private isConnected = false;

  private db = new DB();

  private credentialManager = new CredentialManager();

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Pushes a job onto the queue. 
   * 
   * @param item the job to push
   */
  async push(item: Job) {
    await this.connect();
    await this.redis_functions.push!([this.name, item.id]);
  }

  /**
   * Shifts everything in the queue forwards and pops out the job at the front. 
   * 
   * @returns {Promise{Job | null}} the popped out job
   */
  async shift(): Promise<Job | null> {
    await this.connect();
    const jobId: string = await this.redis_functions.shift!(this.name) as string;
    return this.getJobById(jobId);
  }

  /**
   * Returns whether the queue is empty.
   * 
   * @returns true if empty; false otherwise
   */
  async isEmpty(): Promise<boolean> {
    await this.connect();
    return (await this.redis_functions.length!(this.name)) === 0;
  }

  /**
   * Returns the job at the front of the queue without mutating the queue. 
   * 
   * @returns {Promise{Job | null | undefined}} the job at the front or undefined if empty
   */
  async peek(): Promise<Job | null | undefined> {
    await this.connect();
    if (await this.isEmpty()) return undefined;
    const jobId: string = await this.redis_functions.peek!(this.name, 0, 0) as string;
    return this.getJobById(jobId);
  }

  /**
   * Returns the length of the redis queue. 
   * 
   * @returns {number} length
   */
  async length(): Promise<number> {
    await this.connect();
    return await this.redis_functions.length!(this.name);
  }

  /**
   * Function to connect to the redis client, saving the functions to interface with the database in the process.
   * 
   * @private
   */
  private async connect() {
    if (!this.isConnected) {
      // eslint-disable-next-line
      const client = new redis.createClient({
        host: config.redis.host,
        port: config.redis.port,
      });

      // TODO: rework this redis code to be less hacky
      /* eslint-disable 
        @typescript-eslint/no-unsafe-assignment, 
        @typescript-eslint/no-unsafe-argument, 
        @typescript-eslint/no-unsafe-member-access, 
        @typescript-eslint/no-unsafe-call 
      */
     
      if (config.redis.password !== null && config.redis.password !== undefined) {
        const redisAuth = promisify(client.auth).bind(client);
        await redisAuth(config.redis.password);
      }

      // these save the redis functions rpush, lpop, lrange, llen within any context to promise-based functions
      // and binds them in the context of the redis client defined here (to actually connect to that database)
      this.redis_functions.push = promisify(client.rpush).bind(client);
      this.redis_functions.shift = promisify(client.lpop).bind(client);
      this.redis_functions.peek = promisify(client.lrange).bind(client);
      this.redis_functions.length = promisify(client.llen).bind(client);
      this.isConnected = true;

      /* eslint-disable 
        @typescript-eslint/no-unsafe-assignment, 
        @typescript-eslint/no-unsafe-argument, 
        @typescript-eslint/no-unsafe-member-access, 
        @typescript-eslint/no-unsafe-call 
      */
    }
  }

  /**
   * Gets a job by the jobId. Also populates the job's credentials. 
   *
   * @private
   * @param {string} id jobId
   * @return {Promise<Job | null>} job with the given jobId
   */
  private async getJobById(id: string): Promise<Job | null> {
    const connection = await this.db.connect();
    const jobRepo = connection.getRepository(Job);
    const job = await jobRepo.findOne(id, {
      relations: [
        "remoteExecutableFolder",
        "remoteDataFolder",
        "remoteResultFolder",
      ],
    });

    if (!job) return null;

    if (job.credentialId) {
      job.credential = await this.credentialManager.get(job.credentialId);
    }

    return job;
  }
}

export default Queue;
