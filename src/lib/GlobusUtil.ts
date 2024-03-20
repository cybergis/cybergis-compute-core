import redis = require("redis");
import { promisify } from "util";
import { config } from "../../configs/config";
import DB from "../DB";
import { GlobusTransferRefreshToken } from 
  "../models/GlobusTransferRefreshToken";
import { GlobusFolder, 
  hpcConfig, 
  GetValueFunction, 
  SetValueFunction,
  DelValueFunction } from "../types";
import * as Helper from "./Helper";
import PythonUtil from "./PythonUtil";

/**
 * Class for managing globus tasks, TODO: port the python scripts to the JS Globus SDK (https://www.globus.org/blog/globus-javascript-sdk-now-available)
 */
export class GlobusTaskListManager {

  private redis = {
    getValue: null as null | GetValueFunction,
    setValue: null as null | SetValueFunction,
    delValue: null as null | DelValueFunction,
  };

  private isConnected = false;

  /**
   * Assigns label to taskId
   *
   * @param {string} label - input label
   * @param {string} taskId - setValue id
   */
  async put(label: string, taskId: string) {
    await this.connect();
    await this.redis.setValue!(`globus_task_${label}`, taskId);
  }

  /**
   * Get taskId for specified label
   *
   * @param {string} label - input label
   * @return {Promise<string>} out - redis output
   */
  async get(label: string): Promise<string | null> {
    await this.connect();
    const out = await this.redis.getValue!(`globus_task_${label}`);
    return out ? out : null;
  }

  /**
   * removes taskId for specified label
   *
   * @param {string} label - input label
   */
  async remove(label: string) {
    await this.connect();
    const out = await this.get(label);
    if (!out) return;
    await this.redis.delValue!(`globus_task_${label}`);
  }

  /**
   * @async
   * Connect to globus through redis
   */
  private async connect() {
    if (this.isConnected) return;

    // TODO: rework this redis code to be less hacky
    /* eslint-disable 
      @typescript-eslint/no-unsafe-assignment, 
      @typescript-eslint/no-unsafe-argument, 
      @typescript-eslint/no-unsafe-member-access, 
      @typescript-eslint/no-unsafe-call 
    */

    const client = new redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
    });

    if (config.redis.password !== null && config.redis.password !== undefined) {
      const redisAuth = promisify(client.auth).bind(client);
      await redisAuth(config.redis.password);
    }

    this.redis.getValue = promisify(client.get).bind(client);
    this.redis.setValue = promisify(client.set).bind(client);
    this.redis.delValue = promisify(client.del).bind(client);
    this.isConnected = true;

    /* eslint-disable 
      @typescript-eslint/no-unsafe-assignment, 
      @typescript-eslint/no-unsafe-argument, 
      @typescript-eslint/no-unsafe-member-access, 
      @typescript-eslint/no-unsafe-call 
    */
  }
}

export default class GlobusUtil {
  /**
   * Class for accessing Globus commands
   */

  static db = new DB();

  /**
   * Initializes globus job
   *
   * @static
   * @async
   * @param {GlobusFolder} from - from transfer folder
   * @param {GlobusFolder} to - to transfer folder
   * @param {hpcConfig} hpcConfig - hpcConfiguration
   * @param {string} [label=""] - task label
   * @return {Promise<string>} - taskId
   * @throws {Error} - thrown if globus query status fails
   */
  static async initTransfer(
    from: GlobusFolder,
    to: GlobusFolder,
    hpcConfig: hpcConfig,
    label = ""
  ): Promise<string> {
    const connection = await this.db.connect();
    const globusTransferRefreshTokenRepo = connection.getRepository(
      GlobusTransferRefreshToken
    );

    Helper.nullGuard(hpcConfig.globus);
    const g = await globusTransferRefreshTokenRepo.findOne(
      hpcConfig.globus.identity
    );

    let out: Record<string, unknown>;
    try {
      Helper.nullGuard(g);
      // run python helpers with cmd line arguments to initialize globus
      out = await PythonUtil.run(
        "globus_init.py",
        [
          config.globus_client_id,
          g.transferRefreshToken,
          from.endpoint,
          from.path,
          to.endpoint,
          to.path,
          `${label}_${Math.floor(Math.random() * 1000)}`,
        ],
        ["task_id"]
      );
    } catch (e) {
      throw new Error(`Globus query status failed with error: ${e}`);
    }

    Helper.nullGuard(out.task_id);

    return out.task_id as string;
  }

  /**
   * @static
   * @async
   * Returns output of querying 'globus_monitor.py'
   * @param {string} taskId - taskId of transfer
   * @param {hpcConfig} hpcConfig - hpcConfiguration
   * @return {Promise<string>} - queryStatus string
   */
  static async monitorTransfer(
    taskId: string,
    hpcConfig: hpcConfig
  ): Promise<string> {
    return await this._queryStatus(taskId, hpcConfig, "globus_monitor.py");
  }

  /**
   * @static
   * @async
   * Returns output of querying 'globus_query_status.py'
   * @param {string} taskId - taskId of transfer
   * @param {hpcConfig} hpcConfig - hpcConfiguration
   * @return {Promise<string>} - queryStatus string
   */
  static async queryTransferStatus(
    taskId: string,
    hpcConfig: hpcConfig
  ): Promise<string> {
    return await this._queryStatus(taskId, hpcConfig, "globus_query_status.py");
  }

  /**
   * Maps username according to a specified function. Only nontrivial for the mapping_func `iguide-mapping`.
   * 
   * @param initial_username pre-mapping username
   * @param mapping_func function to use for mapping
   * @returns mapped string
   */
  static async mapUsername(
    initial_username: string,
    mapping_func: string | null
  ): Promise<string> {
    let username: Record<string, unknown>;
    try {
      username = await PythonUtil.run(
        "globus_user_mapping.py",
        [initial_username, mapping_func ?? ""],
        ["mapped_username"]
      );
    } catch (e) {
      throw new Error(`Jupyter-Globus mapping failed with error: ${e}`);
    }

    return username.mapped_username as string;
  }
  /**
   * @static
   * @async
   * Implements the specified globus query
   * @param {string} taskId - taskId of transfer
   * @param {hpcConfig} hpcConfig - hpcConfiguration
   * @param {string} script - query string
   * @throws {Error} - thrown when Globus query status fails
   * @return {Promise<string>} - queryStatus string
   */
  static async _queryStatus(
    taskId: string,
    hpcConfig: hpcConfig,
    script: string
  ): Promise<string> {
    const connection = await this.db.connect();
    const globusTransferRefreshTokenRepo = connection.getRepository(
      GlobusTransferRefreshToken
    );
    const g = await globusTransferRefreshTokenRepo.findOne(
      hpcConfig.globus?.identity
    );

    let out: Record<string, unknown>;
    try {
      Helper.nullGuard(g);
      
      out = await PythonUtil.run(
        script,
        [config.globus_client_id, g.transferRefreshToken, taskId],
        ["status"]
      );
    } catch (e) {
      throw new Error(`Globus query status failed with error: ${e}`);
    }

    return out.status as string;
  }
}
