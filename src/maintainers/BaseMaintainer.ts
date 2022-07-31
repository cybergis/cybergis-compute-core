import { Job } from "../models/Job";
import {
  maintainerConfig,
  event,
  slurm,
  jobMaintainerUpdatable,
  hpcConfig,
} from "../types";
import BaseConnector from "../connectors/BaseConnector";
import SlurmConnector from "../connectors/SlurmConnector";
import validator from "validator";
import { NotImplementedError } from "../errors";
import {
  config,
  hpcConfigMap,
  maintainerConfigMap,
} from "../../configs/config";
import SingularityConnector from "../connectors/SingularityConnector";
import Supervisor from "../Supervisor";
import DB from "../DB";

class BaseMaintainer {
  /** parent pointer **/
  public supervisor: Supervisor;

  /** packages **/
  public validator = validator; // https://github.com/validatorjs/validator.js

  public db: DB;

  /** config **/
  public job: Job = undefined;

  public hpc: hpcConfig = undefined;

  public config: maintainerConfig = undefined;

  public id: string = undefined;

  public slurm: slurm = undefined;

  /** mutex **/
  private _lock = false;

  /** states **/
  public isInit = false;

  public isEnd = false;

  public isPaused = false;

  protected lifeCycleState = {
    initCounter: 0,
    createdAt: null,
  };

  /** parameters **/
  public initRetry = 3;

  public maintainThresholdInHours = 100000; // something super large

  public envParamValidators: { [keys: string]: (val: string) => boolean } =
    undefined;

  public envParamDefault: { [keys: string]: string } = {};

  public envParam: { [keys: string]: string } = {};

  public appParamValidators = undefined;

  public appParam: { [keys: string]: string } = {};

  /** constructor **/
  constructor(job: Job) {
    for (var i in this.envParamValidators) {
      var val = job.env[i];
      if (val != undefined) {
        if (this.envParamValidators[i](val)) this.envParam[i] = val;
      }
    }
    const maintainerConfig = maintainerConfigMap[job.maintainer];
    this.job = job;
    this.config = maintainerConfig;
    this.id = job.id;
    this.slurm = job.slurm;
    this.db = new DB();
    var hpc = job.hpc ? job.hpc : this.config.default_hpc;
    this.hpc = hpcConfigMap[hpc];
    if (!this.hpc) throw new Error("cannot find hpc with name [" + hpc + "]");
    this.onDefine();
  }

  /** HPC connectors **/
  public connector: BaseConnector | SlurmConnector = undefined;

  /** data **/
  protected logs: Array<string> = [];

  protected events: Array<event> = [];

  /** lifecycle interfaces **/
  /**
   * Throw execption when ondefine not implemented
   *
   * @throws {NotImplementedError} - Ondefine is not implemented
   */
  onDefine() {
    throw new NotImplementedError("onDefine not implemented");
  }

  /**
   * Throw execption when oninit not implemented
   *
   * @throws {NotImplementedError} - Oninit is not implemented
   */
  async onInit() {
    throw new NotImplementedError("onInit not implemented");
  }

  /**
   * Throw execption when onmaintain not implemented
   *
   * @throws {NotImplementedError} - Onmaintain is not implemented
   */
  async onMaintain() {
    throw new NotImplementedError("onMaintain not implemented");
  }

  /**
   * Throw execption when onpause not implemented
   *
   * @throws {NotImplementedError} - Onpause is not implemented
   */
  async onPause() {
    throw new NotImplementedError("onPause not implemented");
  }

  /**
   * Throw execption when onresume not implemented
   *
   * @throws {NotImplementedError} - Onresume is not implemented
   */
  async onResume() {
    throw new NotImplementedError("onResume not implemented");
  }

  /**
   * Throw execption when oncancel not implemented
   *
   * @throws {NotImplementedError} - Oncancel is not implemented
   */
  async onCancel() {
    throw new NotImplementedError("onCancel not implemented");
  }

  /** emitters **/
  /**
   * Update this.events with the new event, and this.isInit or this.isEnd as appropriate
   *
   * @param {string} type - Type of event to be recorded
   * @param {string} message - Message associated with the event
   */
  emitEvent(type: string, message: string) {
    if (type === "JOB_INIT") this.isInit = true;
    if (type === "JOB_ENDED" || type === "JOB_FAILED") this.isEnd = true;
    this.events.push({
      type: type,
      message: message,
    });
  }

  /**
   * Update this.events with the new event
   *
   * @param {string} message - Message associated with the event
   */
  emitLog(message: string) {
    this.logs.push(message);
  }

  /** supervisor interfaces **/
  /**
   * Initialize job in the maintainer. If the job has been retried too many times, terminate and update events.
   *
   * @async
   */
  async init() {
    if (this._lock) return;
    this._lock = true;

    if (this.lifeCycleState.initCounter >= this.initRetry) {
      this.emitEvent(
        "JOB_FAILED",
        "initialization counter exceeds " + this.initRetry + " counts"
      );
    } else {
      await this.onInit();
      this.lifeCycleState.initCounter++;
    }

    this._lock = false;
  }

  /**
   * Ensure that the job is still running, and if the runtime has exceeded the maintain threshold, terminate and update events.
   *
   * @async
   */
  async maintain() {
    if (this._lock) return;
    this._lock = true;

    if (this.lifeCycleState.createdAt === null) {
      this.lifeCycleState.createdAt = Date.now();
    }

    if (
      (this.lifeCycleState.createdAt - Date.now()) / (1000 * 60 * 60) >=
      this.maintainThresholdInHours
    ) {
      this.emitEvent(
        "JOB_FAILED",
        "maintain time exceeds " + this.maintainThresholdInHours + " hours"
      );
    } else {
      try {
        await this.onMaintain();
      } catch (e) {
        if (config.is_testing) console.error(e.toString()); // ignore error
      }
    }

    this._lock = false;
  }

  /**
   * Clear all logs in this.logs
   *
   * @async
   * @return {Object} - List of jobs that were just deleted.
   */
  dumpLogs() {
    var logs = this.logs;
    this.logs = [];
    return logs;
  }

  /**
   * Clear all events in this.events
   *
   * @async
   * @return {Object} - List of events that were just deleted.
   */
  dumpEvents() {
    var events = this.events;
    this.events = [];
    return events;
  }

  /**
   * Update this job to reflect the information in the passed job.
   *
   * @async
   * @public
   * @param {jobMaintainerUpdatable} job - New information to update this job with.
   */
  public async updateJob(job: jobMaintainerUpdatable) {
    var connection = await this.db.connect();
    await connection
      .createQueryBuilder()
      .update(Job)
      .where("id = :id", { id: this.id })
      .set(job)
      .execute();
    var jobRepo = connection.getRepository(Job);
    this.job = await jobRepo.findOne(this.id);
  }

  /**
   * Return the slurm connector associated with this job and hpc.
   *
   * @public
   * @returns {SlurmConnector} - The slurm connector associated with this job.
   */
  public getSlurmConnector(): SlurmConnector {
    return new SlurmConnector(this.job.hpc, this.job.id, this, this.job.env);
  }

  /**
   * Return the singularity connector associated with this job and hpc.
   *
   * @public
   * @returns {SingularityConnector} - The singularity connector associated with this job.
   */
  public getSingularityConnector(): SingularityConnector {
    return new SingularityConnector(
      this.job.hpc,
      this.job.id,
      this,
      this.job.env
    );
  }

  /**
   * Return the base connector associated with this job and hpc.
   *
   * @public
   * @returns {BaseConnector} - The base connector associated with this job.
   */
  public getBaseConnector(): BaseConnector {
    return new BaseConnector(this.job.hpc, this.job.id, this, this.job.env);
  }
}

export default BaseMaintainer;
