import { NodeSSH } from "node-ssh";

import { hpcConfigMap } from "../../configs/config";
import * as Helper from "../helpers/Helper";

import { CredentialManager } from "./Redis";

/**
 * Class for storing ssh credentials; does validation in addition to interfacing with a redis database.
 */
class SSHCredentialGuard {
  private credentialManager = new CredentialManager();

  private ssh = new NodeSSH();
  
  /**
   * Tries to establish an SSH connection with the hpc.
   * @param hpcName name of the hpc to check with
   * @param user username of the ssh connection
   * @param password password of the ssh connection
   * @throws {Error} may be unable to cross check crecdentials with a given hpc
   * @returns whether or not the private account was valid
   */
  async validatePrivateAccount(
    hpcName: string,
    user?: string,
    password?: string
  ): Promise<boolean> {
    const hpc = hpcConfigMap[hpcName];

    try {
      await this.ssh.connect({
        host: hpc.ip,
        port: hpc.port,
        username: user,
        password: password,
      });
      this.ssh.dispose();

      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Registers a credential onto the redis store with a generated Id as the key. 
   * @param user username of the ssh connection
   * @param password password of the ssh connection
   * @returns the assigned redis key/id
   */
  async registerCredential(
    user?: string,
    password?: string
  ): Promise<string> {
    const credentialId = Helper.generateId();
    await this.credentialManager.add(credentialId, {
      id: credentialId,
      user: user,
      password: password,
    });
    return credentialId;
  }
}

export default SSHCredentialGuard;
export { CredentialManager, SSHCredentialGuard };
