import { NodeSSH } from "node-ssh";

import { config, hpcConfigMap } from "../../configs/config";
import { SSH, SSHConfig } from "../definitions";
import * as Helper from "../helpers/Helper";
import { Job } from "../models";

interface Connection {
  ssh: SSH;
  lastUsed: number;
  count: number;
}

const TIMEOUT = 3 * 60 * 1000;

/**
 * Class that abstracts away a connection pool of various ssh connections. Handles automatic closing and caching of connections to prevent unnecessary overhead.
 */
class ConnectionPool {
  private jobConnectionPool: Record<string, Connection> = {};

  private hpcConnectionPool: Record<string, Connection> = {};
  private hpcConnectionSettings: Record<string, SSHConfig> = {};

  /**
   * 
   */
  public constructor() {
    for (const hpcName in hpcConfigMap) {
      const hpcConfig = hpcConfigMap[hpcName];
      if (!hpcConfig.is_community_account) continue;

      // register community account SSH
      const sshConfig: SSHConfig = {
        host: hpcConfig.ip,
        port: hpcConfig.port,
        username: hpcConfig.community_login.user,
      };

      if (hpcConfig.community_login.use_local_key) {
        sshConfig.privateKeyPath = config.local_key.private_key_path;
        if (config.local_key.passphrase) {
          sshConfig.passphrase = config.local_key.passphrase as string;
        }
      } else {
        sshConfig.privateKeyPath =
      hpcConfig.community_login.external_key.private_key_path;
        if (hpcConfig.community_login.external_key.passphrase) {
          sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase;
        }
      }

      this.hpcConnectionPool[hpcName] = { ssh: new NodeSSH(), count: 0, lastUsed: 0 };
      this.hpcConnectionSettings[hpcName] = sshConfig;
    }

    setInterval(() => {this.cleanupJobs();}, TIMEOUT);
  }

  /**
   * gets the ssh connection for a given HPC
   * @param hpcName name of the hpc to get the conneciton to 
   * @returns ssh connection (bad connection if connection impossible)
   */
  public async getHpcConnection(hpcName: string): Promise<SSH> {
    if (!(hpcName in this.hpcConnectionPool)) {
      return new NodeSSH();
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.ssh.isConnected()) {
      return connection.ssh;
    }

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection.ssh, this.hpcConnectionSettings[hpcName]], null);
    } catch (_) {
      return new NodeSSH();
    }

    return connection.ssh;
  }

  /**
   *
   * @param job job whose ssh connection to release
   */
  public releaseJobConnection(job: Job) {
    if (!(job.id in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.jobConnectionPool[job.id];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  /**
   *
   * @param hpcName hpc whose ssh connection should be released
   */
  public releaseHpcConnection(hpcName: string) {
    if (!(hpcName in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  /**
   * gets the ssh connection for a specific job; does not throw an error
   * @param job which job to get the ssh connection for 
   * @returns ssh connection (invalid if connection wasn't possible)
   */
  public async getJobConnection(job: Job): Promise<NodeSSH> {
    if (!(job.id in this.jobConnectionPool)) {
      this.jobConnectionPool[job.id] = {
        ssh: new NodeSSH(),
        count: 0,
        lastUsed: 0
      };
    }

    const connection = this.jobConnectionPool[job.id];
    connection.lastUsed = Date.now();
    connection.count++;

    if (connection.ssh.isConnected()) {
      return connection.ssh;
    }

    const hpcConfig = hpcConfigMap[job.hpc];
    const config: SSHConfig = {
      host: hpcConfig.ip,
      port: hpcConfig.port,
      username: job.credential?.user,
      password: job.credential?.password,
      readyTimeout: 1000,
    };

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection.ssh, config], null);
    } catch (_) {
      return new NodeSSH();
    }

    return connection.ssh;
  }

  /**
   *
   */
  private cleanupJobs() {
    const time = Date.now();
    for (const hpc in this.hpcConnectionPool) {
      const connection = this.hpcConnectionPool[hpc];

      const shouldDispose = connection.count === 0 && time - connection.lastUsed > TIMEOUT || 
                      time - connection.lastUsed > 4 * TIMEOUT;

      if (shouldDispose) {
        connection.ssh.dispose();
  
        if (time - connection.lastUsed > 4 * TIMEOUT) {
          connection.count = 0;
        }
      }
    }

    for (const job in this.jobConnectionPool) {
      const connection = this.jobConnectionPool[job];

      const shouldDispose = connection.count === 0 && time - connection.lastUsed > TIMEOUT || 
                      time - connection.lastUsed > 4 * TIMEOUT;

      if (shouldDispose) {
        delete this.jobConnectionPool[job];
        connection.ssh.dispose();
  
        if (time - connection.lastUsed > 4 * TIMEOUT) {
          connection.count = 0;
        }
      }
    }
  }
}

export const connectionPool = new ConnectionPool();