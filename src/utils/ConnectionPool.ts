import NodeSSH = require("node-ssh");

import { config, hpcConfigMap } from "../../configs/config";
import { SSH, SSHConfig } from "../definitions";
import * as Helper from "../helpers/Helper";
import { Job } from "../models";

export class ConnectionPool {
  private jobConnectionPool: Record<string, NodeSSH> = {};
  private jobConnectionCounts: Record<string, number> = {};

  private hpcConnectionPool: Record<string, NodeSSH> = {};
  private hpcConnectionCounts: Record<string, number> = {};
  private hpcConnectionSettings: Record<string, SSHConfig> = {};

  constructor() {
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

      this.hpcConnectionPool[hpcName] = new NodeSSH();
      this.hpcConnectionSettings[hpcName] = sshConfig;
      this.hpcConnectionCounts[hpcName] = 0;
    }
  }

  public initHpcConnection(hpcName: string) {
    this.hpcConnectionCounts[hpcName]++;
  }

  public initJobConnection(job: Job) {
    if (job.id in this.jobConnectionCounts) {
      this.jobConnectionCounts[job.id]++;
    } else {
      this.jobConnectionCounts[job.id] = 1;
      this.jobConnectionPool[job.id] = new NodeSSH();
    }
  }

  public releaseHpcConnection(hpcName: string) {
    if (this.hpcConnectionCounts[hpcName] === 0) {
      return;
    }


    this.hpcConnectionCounts[hpcName]--;

    if (this.hpcConnectionCounts[hpcName] === 0 && this.hpcConnectionPool[hpcName].isConnected()) {
      this.hpcConnectionPool[hpcName].dispose();
    }
  }

  public releaseJobConnection(job: Job) {
    if (!(job.id in this.jobConnectionCounts)) {
      return;
    }

    this.jobConnectionCounts[job.id]--;
    if (this.jobConnectionCounts[job.id] === 0) {
      delete this.jobConnectionCounts[job.id];
      this.jobConnectionPool[job.id].dispose();
      delete this.jobConnectionPool[job.id];
    }
  }

  public async getHpcConnection(hpcName: string): Promise<SSH> {
    this.hpcConnectionCounts[hpcName]++;
    const connection = this.hpcConnectionPool[hpcName];

    if (connection.isConnected()) {
      return connection;
    }

    try {
      // wraps command with backoff -> takes lambda function and array of inputs to execute command
      await Helper.runCommandWithBackoff((async (ssh: SSH, config: SSHConfig) => {
        await ssh.connect(config);
        await ssh.execCommand("echo");
      }), [connection, this.hpcConnectionSettings[hpcName]], null);
    } catch (e) {
      return new NodeSSH();
    }

    return connection;
  }

  public async getJobConnection(job: Job): Promise<NodeSSH> {
    if (!(job.id in this.jobConnectionPool)) {
      throw Error("Job has not been initialized yet");
    }

    this.hpcConnectionCounts[job.id]++;
    const ssh = this.jobConnectionPool[job.id];

    if (ssh.isConnected()) {
      return ssh;
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
      }), [ssh, config], null);
    } catch (e) {
      return new NodeSSH();
    }


    return ssh;
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
