import NodeSSH = require("node-ssh");

import { config, hpcConfigMap } from "../../configs/config";
import { SSH, SSHConfig } from "../definitions";
import * as Helper from "../helpers/Helper";
import { Job } from "../models";

// TODO: have more sophisticated way to do this
interface Connection {
  ssh: NodeSSH;
  timeout?: NodeJS.Timeout;
  count: number;
}

const TIMEOUT = 3 * 60 * 1000;

export class ConnectionPool {
  private jobConnectionPool: Record<string, Connection> = {};

  private hpcConnectionPool: Record<string, Connection> = {};
  private hpcConnectionSettings: Record<string, SSHConfig> = {};

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
        sshConfig.privateKey = config.local_key.private_key_path;
        if (config.local_key.passphrase) {
          sshConfig.passphrase = config.local_key.passphrase as string;
        }
      } else {
        sshConfig.privateKey =
          hpcConfig.community_login.external_key.private_key_path;
        if (hpcConfig.community_login.external_key.passphrase) {
          sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase;
        }
      }

      this.hpcConnectionPool[hpcName] = { ssh: new NodeSSH(), count: 0 };
      this.hpcConnectionSettings[hpcName] = sshConfig;
    }
  }

  public async getHpcConnection(hpcName: string): Promise<SSH> {
    if (!(hpcName in this.hpcConnectionPool)) {
      return new NodeSSH();
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.ssh.isConnected()) {
      return connection.ssh;
    }

    clearTimeout(connection.timeout);

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection.ssh, this.hpcConnectionSettings[hpcName]], null);

      connection.timeout = this.startHpcTimeoutLoop(hpcName);
    } catch (e) {
      return new NodeSSH();
    }

    return connection.ssh;
  }

  public releaseJobConnection(job: Job) {
    if (!(job.id in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.jobConnectionPool[job.id];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  public releaseHpcConnection(hpcName: string) {
    if (!(hpcName in this.hpcConnectionPool)) {
      return;
    }

    const connection = this.hpcConnectionPool[hpcName];

    if (connection.count > 0) {
      connection.count -= 1;
    }
  }

  public async getJobConnection(job: Job): Promise<NodeSSH> {
    if (!(job.id in this.jobConnectionPool)) {
      this.jobConnectionPool[job.id] = {
        ssh: new NodeSSH(),
        count: 0
      };
    }

    const connection = this.jobConnectionPool[job.id];

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

        connection.timeout = this.startJobTimeoutLoop(job.id);
      }), [connection.ssh, config], null);
    } catch (e) {
      return new NodeSSH();
    }


    return connection.ssh;
  }

  private startHpcTimeoutLoop(key: string): NodeJS.Timeout {
    return setTimeout(() => {
      if (!(key in this.hpcConnectionPool)) {
        return; 
      }

      const connection = this.hpcConnectionPool[key];

      if (connection.count === 0) {
        if (connection.ssh.isConnected()) {
          connection.ssh.dispose();
        }
        return;
      } else {
        connection.timeout = this.startHpcTimeoutLoop(key);
      }
    }, TIMEOUT);
  }

  private startJobTimeoutLoop(id: string): NodeJS.Timeout {
    return setTimeout(() => {
      if (!(id in this.jobConnectionPool)) {
        return; 
      }

      const connection = this.jobConnectionPool[id];

      if (connection.count === 0) {
        if (connection.ssh.isConnected()) {
          connection.ssh.dispose();
        }

        delete this.jobConnectionPool[id];
      } else {
        connection.timeout = this.startJobTimeoutLoop(id);
      }
    }, TIMEOUT);
  }
}

export const connectionPool = new ConnectionPool();



// // dictionary recording ssh connections for community accounts (which have public ssh ability)
// const connectionPool: Record<string, { counter: number, ssh: SSH }> = {};

// // populates the connectionPool with community account HPCs
// for (const hpcName in hpcConfigMap) {
//   const hpcConfig = hpcConfigMap[hpcName];
//   if (!hpcConfig.is_community_account) continue;

//   // register community account SSH
//   const sshConfig: SSHConfig = {
//     host: hpcConfig.ip,
//     port: hpcConfig.port,
//     username: hpcConfig.community_login.user,
//   };

//   if (hpcConfig.community_login.use_local_key) {
//     sshConfig.privateKey = config.local_key.private_key_path;
//     if (config.local_key.passphrase) {
//       sshConfig.passphrase = config.local_key.passphrase as string;
//     }
//   } else {
//     sshConfig.privateKey =
//       hpcConfig.community_login.external_key.private_key_path;
//     if (hpcConfig.community_login.external_key.passphrase) {
//       sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase;
//     }
//   }

//   connectionPool[hpcName] = {
//     counter: 0,
//     ssh: {
//       connection: new NodeSSH(),
//       config: sshConfig,
//     },
//   };
// }

// export default connectionPool;
