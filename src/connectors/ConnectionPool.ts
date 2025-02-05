import NodeSSH = require("node-ssh");

import { config, hpcConfigMap } from "../../configs/config";
import { SSH, SSHConfig } from "../definitions";

export class ConnectionPool2 {
  private config: Record<string, HPCConfig>;

  constructor(hpcConfigMap: Record<string, HPCConfig>) {
    this.config = hpcConfigMap;
  }
}

// dictionary recording ssh connections for community accounts (which have public ssh ability)
const connectionPool: Record<string, { counter: number, ssh: SSH }> = {};

// populates the connectionPool with community account HPCs
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

  connectionPool[hpcName] = {
    counter: 0,
    ssh: {
      connection: new NodeSSH(),
      config: sshConfig,
    },
  };
}

export default connectionPool;
