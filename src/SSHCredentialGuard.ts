import Helper from "./Helper";
import { credential } from "./types";
import { config, hpcConfigMap } from "../configs/config";
import NodeSSH = require("node-ssh");
import redis = require("redis");
import { promisify } from "util";

/**
 * This is a helper class that interfaces with the redis credential manager store.
 */
class CredentialManager {
  private redis = {
    getValue: null,
    setValue: null,
    delValue: null,
  };

  private isConnected = false;

  /**
   * Adds a key-credential pair to the redis store.
   *
   * @param {string} key
   * @param {credential} cred credential
   */
  async add(key: string, cred: credential) {
    await this.connect();
    await this.redis.setValue(key, JSON.stringify(cred));
  }

  /**
   * Gets the credentials associated with a given key. 
   *
   * @param {string} key target key
   * @return {Promise<credential>} associated credential
   */
  async get(key: string): Promise<credential> {
    await this.connect();
    return JSON.parse(await this.redis.getValue(key));
  }

  /**
   * Establishes a connection with the redis client.
   *
   * @private
   */
  private async connect() {
    if (this.isConnected) return;

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
  }
}


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
    user: string,
    password: string
  ) {
    const hpc = hpcConfigMap[hpcName];

    try {
      await this.ssh.connect({
        host: hpc.ip,
        port: hpc.port,
        // user: user,
        password: password,
      });
      await this.ssh.dispose();
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
  async registerCredential(user: string, password: string): Promise<string> {
    const credentialId = Helper.generateId();
    this.credentialManager.add(credentialId, {
      id: credentialId,
      user: user,
      password: password,
    });
    return credentialId;
  }
}

export default SSHCredentialGuard;
export { CredentialManager, SSHCredentialGuard };
