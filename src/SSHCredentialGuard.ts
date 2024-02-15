import NodeSSH = require("node-ssh");
import redis = require("redis");
import { promisify } from "util";
import { config, hpcConfigMap } from "../configs/config";
import Helper from "./Helper";
import { credential } from "./types";

type GetValueFunction = (_key: unknown) => Promise<string>;
type SetValueFunction = (_key: unknown, _value: string) => Promise<string>;  // possibly not string
type DelValueFunction = (_keys: unknown[]) => Promise<number>;

/**
 * This is a helper class that interfaces with the redis credential manager store.
 */
class CredentialManager {
  private redis_functions = {
    getValue: null as GetValueFunction | null,
    setValue: null as SetValueFunction | null,
    delValue: null as DelValueFunction | null,
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
    await this.redis_functions.setValue!(key, JSON.stringify(cred));
  }

  /**
   * Gets the credentials associated with a given key. 
   *
   * @param {string} key target key
   * @return {Promise<credential>} associated credential
   */
  async get(key: string): Promise<credential> {
    await this.connect();
    return JSON.parse(await this.redis_functions.getValue!(key)) as Promise<credential>;
  }

  // TODO: rework this redis code to be less hacky
  /* eslint-disable 
    @typescript-eslint/no-unsafe-assignment, 
    @typescript-eslint/no-unsafe-argument, 
    @typescript-eslint/no-unsafe-member-access, 
    @typescript-eslint/no-unsafe-call 
  */

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

    this.redis_functions.getValue = promisify(client.get).bind(client);
    this.redis_functions.setValue = promisify(client.set).bind(client);
    this.redis_functions.delValue = promisify(client.del).bind(client);
    this.isConnected = true;
  }

  /* eslint-disable 
    @typescript-eslint/no-unsafe-assignment, 
    @typescript-eslint/no-unsafe-argument, 
    @typescript-eslint/no-unsafe-member-access, 
    @typescript-eslint/no-unsafe-call 
  */
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
    user: string | undefined,
    password: string | undefined
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
  async registerCredential(user: string | undefined, password: string | undefined): Promise<string> {
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
