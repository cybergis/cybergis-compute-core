import NodeSSH = require("node-ssh");

import { hpcConfigMap } from "../../configs/config";
import * as Helper from "../helpers/Helper";

import { CredentialManager } from "./Redis";

class SSHCredentialGuard {
  private credentialManager = new CredentialManager();

  private ssh = new NodeSSH();
  
  /**
   * Tries to establish an SSH connection with the hpc.
   *
   * @param {string} hpcName name of the hpc to check with
   * @param {string} user username (not used)
   * @param {string} password
   * @throws {Error} may be unable to cross check crecdentials with a given hpc
   */
  async validatePrivateAccount(
    hpcName: string,
    user?: string,
    password?: string
  ) {
    const hpc = hpcConfigMap[hpcName];

    try {
      await this.ssh.connect({
        host: hpc.ip,
        port: hpc.port,
        username: user,
        password: password,
      });
      this.ssh.dispose();
    } catch (e) {
      throw new Error(`unable to check credentials with ${hpcName}`);
    }
  }

  /**
   * Registers a credential onto the redis store with a generated Id as the key. 
   *
   * @param {string} user username
   * @param {string} password
   * @return {Promise<string>} the assigned redis key/id
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
