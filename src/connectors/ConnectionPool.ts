import NodeSSH = require('node-ssh')
import { SSH, SSHConfig } from '../types'
import { config, hpcConfigMap } from '../../configs/config'

const connectionPool: { [keys: string]: { counter: number, ssh: SSH } } = {}

for (var hpcName in hpcConfigMap) {
    var hpcConfig = hpcConfigMap[hpcName]
    if (!hpcConfig.is_community_account) continue

    // register community account SSH
    const sshConfig: SSHConfig = {
        host: hpcConfig.ip,
        port: hpcConfig.port,
        username: hpcConfig.community_login.user
    }

    if (hpcConfig.community_login.use_local_key) {
        sshConfig.privateKey = config.local_key.private_key_path
        if (config.local_key.passphrase) {
            sshConfig.passphrase = config.local_key.passphrase
        }
    } else {
        sshConfig.privateKey = hpcConfig.community_login.external_key.private_key_path
        if (hpcConfig.community_login.external_key.passphrase) {
            sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase
        }
    }

    connectionPool[hpcName] = {
        counter: 0,
        ssh: {
            connection: new NodeSSH(),
            config: sshConfig
        }
    }
}

export default connectionPool