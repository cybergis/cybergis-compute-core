import { Job } from "./models/Job";
import { config } from "../configs/config";
import DB from "./DB";
import { CredentialManager } from "./SSHCredentialGuard";
import { promisify } from "util";
import redis = require("redis");

/**
 * This class is used to represent queues of jobs waiting to be executed. 
 */
class Queue {
  private name;

  private redis = {
    push: null,
    shift: null,
    peak: null,
    length: null,
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
    await this.redis.push([this.name, item.id]);
  }

  /**
   * Shifts everything in the queue forwards and pops out the job at the front. 
   * 
   * @returns {Promise{Job}} the popped out job
   */
  async shift(): Promise<Job> {
    await this.connect();
    const jobId: string = await this.redis.shift(this.name);
    return this.getJobById(jobId);
  }

  /**
   * Returns whether the queue is empty.
   * 
   * @returns true if empty; false otherwise
   */
  async isEmpty(): Promise<boolean> {
    await this.connect();
    return (await this.redis.length(this.name)) === 0;
  }

  /**
   * Returns the job at the front of the queue without mutating the queue. 
   * 
   * @returns {Promise{Job | undefined}} the job at the front or undefined if empty
   */
  async peak(): Promise<Job | undefined> {
    await this.connect();
    if (await this.isEmpty()) return undefined;
    const jobId: string = await this.redis.peak(this.name, 0, 0);
    return this.getJobById(jobId);
  }

  /**
   * Returns the length of the redis queue. 
   * 
   * @returns {number} length
   */
  async length(): Promise<number> {
    await this.connect();
    return await this.redis.length(this.name);
  }

  /**
   * Function to connect to the redis client, saving the functions to interface with the database in the process.
   * 
   * @private
   */
  private async connect() {
    if (!this.isConnected) {
      const client = new redis.createClient({
        host: config.redis.host,
        port: config.redis.port,
      });

      if (config.redis.password !== null && config.redis.password !== undefined) {
        const redisAuth = promisify(client.auth).bind(client);
        await redisAuth(config.redis.password);
      }

      this.redis.push = promisify(client.rpush).bind(client);
      this.redis.shift = promisify(client.lpop).bind(client);
      this.redis.peak = promisify(client.lrange).bind(client);
      this.redis.length = promisify(client.llen).bind(client);
      this.isConnected = true;
    }
  }

  /**
   * Gets a job by the jobId. Also populates the job's credentials. 
   *
   * @private
   * @param {string} id jobId
   * @return {Promise<Job>} job with the given jobId
   */
  private async getJobById(id: string): Promise<Job> {
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
