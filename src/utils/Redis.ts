import { RedisClientType, createClient } from "redis";

import { config } from "../../configs/config";
import { Job } from "../models/Job";

import dataSource from "./DB";
import { credential } from "./types";

class RedisStore {

  protected client: RedisClientType;

  public constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port
      },
      password: config.redis.password
    });

    this.client.connect()
      .catch((err) => {
        console.error(err);
      });
  }

  public async disconnect() {
    await this.client.disconnect();
  }
}


/**
 * Class for managing globus tasks, TODO: port the python scripts to the JS Globus SDK (https://www.globus.org/blog/globus-javascript-sdk-now-available)
 */
export class GlobusTaskListManager extends RedisStore {

  public constructor() {
    super();
  }

  /**
   * Assigns label to taskId
   *
   * @param {string} label - input label
   * @param {string} taskId - setValue id
   */
  public async put(label: string, taskId: string) {
    await this.client.SET(`globus_task_${label}`, taskId);
  }

  /**
   * Get taskId for specified label
   *
   * @param {string} label - input label
   * @return {Promise<string>} out - redis output
   */
  public async get(label: string): Promise<string | null> {
    return this.client.GET(`globus_task_${label}`);
  }

  /**
   * removes taskId for specified label
   *
   * @param {string} label - input label
   */
  public async remove(label: string) {
    const out = await this.get(label);

    if (!out) {
      return;
    }

    await this.client.DEL(`globus_task_${label}`);
  }
}

/**
 * Helper class to interface with the jobs redis result folder.
 */
export class ResultFolderContentManager extends RedisStore {

  public constructor() {
    super();
  }

  /**
   * Set the value of the job result folder to the contents passed
   *
   * @async
   * @param {string} jobId - This job
   * @param {string[]} contents - Contents to be listed in the result folder
   */
  public async put(jobId: string, contents: string[]) {
    await this.client.SET(`job_result_folder_content${jobId}`, JSON.stringify(contents));
  }

  /**
   * Return the parsed contents of the results folder
   *
   * @async
   * @param {string} jobId - This job
   * @returns {string[] | null} - Contents of the results folder
   */
  public async get(jobId: string): Promise<string[] | null> {
    const out = await this.client.GET(`job_result_folder_content${jobId}`);
    return out ? JSON.parse(out) as string[] : null;
  }

  /**
   * Delete the result folder content associated with this job
   *
   * @async
   * @param {string} jobId - This job
   */
  public async remove(jobId: string) {
    const out = await this.get(jobId);

    if (!out) {
      return;
    }

    await this.client.DEL(`job_result_folder_content${jobId}`);
  }
}

/**
 * This class is used to represent queues of jobs waiting to be executed. 
 */
export class JobQueue extends RedisStore {
  private name: string;
  private credentialManager = new CredentialManager();

  public constructor(name: string) {
    super();

    this.name = name;
  }

  /**
   * Pushes a job onto the queue. 
   * 
   * @param item the job to push
   */
  public async push(item: Job) {
    await this.client.RPUSH(this.name, item.id);
  }

  /**
   * Shifts everything in the queue forwards and pops out the job at the front. 
   * 
   * @returns {Promise{Job | null}} the popped out job
   */
  public async pop(): Promise<Job | null> {
    const jobId = await this.client.LPOP(this.name);

    if (jobId === null) {
      return null;
    }

    return this.getJobById(jobId);
  }

  /**
   * Returns whether the queue is empty.
   * 
   * @returns true if empty; false otherwise
   */
  public async isEmpty(): Promise<boolean> {
    return (await this.client.LLEN(this.name)) === 0;
  }

  /**
   * Returns the job at the front of the queue without mutating the queue. 
   * 
   * @returns {Promise{Job | null | undefined}} the job at the front or undefined if empty
   */
  public async peek(): Promise<Job | null> {
    if (await this.isEmpty()) {
      return null;
    }

    const jobId = (await this.client.LRANGE(this.name, 0, 0))[0];
    
    return this.getJobById(jobId);
  }

  /**
   * Returns the length of the redis queue. 
   * 
   * @returns {number} length
   */
  async length(): Promise<number> {
    return this.client.LLEN(this.name);
  }

  /**
   * Gets a job by the jobId. Also populates the job's credentials. 
   *
   * @private
   * @param {string} id jobId
   * @return {Promise<Job | null>} job with the given jobId
   */
  private async getJobById(id: string): Promise<Job | null> {
    const jobRepo = dataSource.getRepository(Job);
    const job = await jobRepo.findOne({
      where: { id: id }, 
      relations: [
        "remoteExecutableFolder",
        "remoteDataFolder",
        "remoteResultFolder",
      ],
    });

    if (!job) return null;

    if (job.credentialId) {
      job.credential = (await this.credentialManager.get(job.credentialId))!;
    }

    return job;
  }
}

/**
 * This is a helper class that interfaces with the redis credential manager store.
 */
export class CredentialManager extends RedisStore {

  public constructor() {
    super();
  }

  /**
   * Adds a key-credential pair to the redis store.
   *
   * @param {string} key
   * @param {credential} cred credential
   */
  async add(key: string, cred: credential) {
    await this.client.SET(key, JSON.stringify(cred));
  }

  /**
   * Gets the credentials associated with a given key. 
   *
   * @param {string} key target key
   * @return {Promise<credential>} associated credential
   */
  async get(key: string): Promise<credential | null> {
    const out = await this.client.GET(key);

    if (out === null) {
      return null;
    }

    return JSON.parse(out) as credential;
  }
}