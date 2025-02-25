import { config } from "../../configs/config";
import { GlobusTransferRefreshToken } from 
  "../models/GlobusTransferRefreshToken";
import dataSource from "../utils/DB";
import { GlobusFolder, hpcConfig } from "../utils/types";

import * as Helper from "./Helper";
import PythonUtil from "./PythonUtil";

export default class GlobusUtil {
  /**
   * Class for accessing Globus commands
   */

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
    const globusTransferRefreshTokenRepo = dataSource.getRepository(
      GlobusTransferRefreshToken
    );

    const g = await globusTransferRefreshTokenRepo.findOneBy({
      identity: hpcConfig.globus.identity
    });

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
      throw new Error(`Globus query status failed with error: ${Helper.assertError(e).toString()}`);
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
    return this._queryStatus(taskId, hpcConfig, "globus_monitor.py");
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
    return this._queryStatus(taskId, hpcConfig, "globus_query_status.py");
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
      throw new Error(`Jupyter-Globus mapping failed with error: ${Helper.assertError(e).toString()}`);
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
    const globusTransferRefreshTokenRepo = dataSource.getRepository(
      GlobusTransferRefreshToken
    );
    const g = await globusTransferRefreshTokenRepo.findOneBy({
      identity: hpcConfig.globus.identity
    });

    let out: Record<string, unknown>;
    try {
      Helper.nullGuard(g);
      
      out = await PythonUtil.run(
        script,
        [config.globus_client_id, g.transferRefreshToken, taskId],
        ["status"]
      );
    } catch (e) {
      throw new Error(`Globus query status failed with error: ${Helper.assertError(e).toString()}`);
    }

    return out.status as string;
  }
}
