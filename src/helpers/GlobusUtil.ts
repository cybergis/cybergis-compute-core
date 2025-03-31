import { config } from "../../configs/config";
import { GlobusFolder, hpcConfig } from "../definitions";
import { GlobusTransferRefreshToken } from 
  "../models";
import dataSource from "../utils/DB";

import * as Helper from "./Helper";
import * as PythonUtil from "./PythonUtil";

/**
 * Class for accessing Globus commands
 */

/**
 * Initializes globus job
 * @param from - from transfer folder
 * @param to - to transfer folder
 * @param hpcConfig - hpcConfiguration
 * @param [label] - task label
 * @returns - taskId
 * @throws {Error} - thrown if globus query status fails
 */
export async function initTransfer(
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
 * 
 * Returns output of querying 'globus_monitor.py'
 * @param taskId - taskId of transfer
 * @param hpcConfig - hpcConfiguration
 * @returns - queryStatus string
 */
export async function monitorTransfer(
  taskId: string,
  hpcConfig: hpcConfig
): Promise<string> {
  return _queryStatus(taskId, hpcConfig, "globus_monitor.py");
}

/**
 * 
 * Returns output of querying 'globus_query_status.py'
 * @param taskId - taskId of transfer
 * @param hpcConfig - hpcConfiguration
 * @returns - queryStatus string
 */
export async function queryTransferStatus(
  taskId: string,
  hpcConfig: hpcConfig
): Promise<string> {
  return _queryStatus(taskId, hpcConfig, "globus_query_status.py");
}

/**
 * Maps username according to a specified function. Only nontrivial for the mapping_func `iguide-mapping`.
 * @param initial_username pre-mapping username
 * @param mapping_func function to use for mapping
 * @returns mapped string
 */
export async function mapUsername(
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
 * 
 * Implements the specified globus query
 * @param taskId - taskId of transfer
 * @param hpcConfig - hpcConfiguration
 * @param script - query string
 * @throws {Error} - thrown when Globus query status fails
 * @returns - queryStatus string
 */
async function _queryStatus(
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
