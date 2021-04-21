import { manifest, options, hpcConfig } from "../types"
import { ConnectorError } from '../errors'
import { config } from '../../configs/config'
import BaseMaintainer from '../maintainers/BaseMaintainer'
import { LocalFile } from '../FileSystem'
import * as path from 'path'
import NodeSSH = require('node-ssh')

class BaseConnector {
    public ssh: NodeSSH

    public jobID: string

    public maintainer: BaseMaintainer

    public config: hpcConfig

    protected sshConfig

    protected isLoggedIn = false

    protected envCmd = '#!/bin/bash\n'

    constructor(manifest: manifest, hpcConfig: hpcConfig, maintainer: BaseMaintainer = null) {
        this.ssh = new NodeSSH()
        this.jobID = manifest.id
        this.config = hpcConfig

        this.sshConfig = {
            host: hpcConfig.ip,
            port: hpcConfig.port
        }

        if (hpcConfig.is_community_account) {
            this.sshConfig.user = hpcConfig.community_login.user
            if (hpcConfig.community_login.use_local_key) {
                this.sshConfig.privateKey = config.local_key.private_key_path
                this.sshConfig.passphrase = config.local_key.passphrase
            } else {
                this.sshConfig.privateKey = hpcConfig.community_login.external_key.private_key_path
                this.sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase
            }
        } else {
            // need support for user upload keys
            this.sshConfig.user = manifest.cred.usr
            this.sshConfig.password = manifest.cred.pwd
        }

        this.maintainer = maintainer
    }

    /** actions **/
    async connect(env = {}) {
        if (this.isLoggedIn) return

        try {
            await this.ssh.connect(this.sshConfig)
            this.isLoggedIn = true
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_CONNECTION', 'successfully connected to server [' + this.sshConfig.ip + ':' + this.sshConfig.port + ']')

            // generate env bash cmd
            var envCmd = 'source /etc/profile;'
            for (var i in env) {
                var v = env[i]
                envCmd += `export ${i}=${v};\n`
            }
            this.envCmd = envCmd
        } catch (e) {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_CONNECTION_ERROR', 'connection to server [' + this.sshConfig.ip + ':' + this.sshConfig.port + '] failed with error: ' + e)
            this.isLoggedIn = false
        }
    }

    async disconnect() {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_DISCONNECTION', 'disconnected with server [' + this.sshConfig.ip + ':' + this.sshConfig.port + ']')
        await this.ssh.dispose()
    }

    async exec(commands: string | Array<string>, options: options = {}, continueOnError = false, mute = false) {
        type out = {
            stdout: string | null
            stderr: string | null
        }

        var out: out = {
            stdout: null,
            stderr: null
        }
        var maintainer = this.maintainer

        if (typeof commands == 'string') {
            commands = [commands]
        }

        var opt = Object.assign({
            onStdout(o) {
                o = o.toString()
                if (out.stdout != null) out.stdout = o
                    else out.stdout += o

                if (maintainer != null) maintainer.emitLog(o)
            },
            onStderr(o) {
                o = o.toString()
                if (out.stderr != null) out.stderr = o
                    else out.stderr += o

                if (maintainer != null) {
                    maintainer.emitLog(o)
                    maintainer.emitEvent('SSH_STDERR', o)
                }
            }
        }, options)

        for (var i in commands) {
            var command = commands[i]
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_RUN', 'running command [' + command + ']')
            await this.ssh.execCommand(this.envCmd + command, opt)
            if (out.stderr != null && !continueOnError) break // behavior similar to &&
        }

        return out
    }

    /** file operators **/
    async download(from: string, to: LocalFile) {
        var fromZipFilePath = from.endsWith('.zip') ? from : `${from}.zip`
        var toZipFilePath = `${to.path}.zip`
        this.zip(from, fromZipFilePath)

        try {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD', `get file from ${from} to ${to}`)
            await this.ssh.getFile(from, toZipFilePath)
        } catch (e) {
            var error = `unable to get file from ${from} to ${to}: ` + e.toString()
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

    }

    async upload(from: LocalFile, to: string) {
        var fromZipFilePath = await this.maintainer.executable_file.getZip()
        var toZipFilePath = to.endsWith('.zip') ? to : `${to}.zip`
        var toFilePath = to.endsWith('.zip') ? to.replace('.zip', '') : to

        try {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_UPLOAD', `put file from ${from} to ${to}`)
            await this.ssh.putFile(fromZipFilePath, toZipFilePath)
        } catch (e) {
            var error = `unable to put file from ${fromZipFilePath} to ${toZipFilePath}: ` + e.toString()
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_UPLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

        await this.unzip(toZipFilePath, toFilePath)
    }

    /** helpers **/

    // getters
    async homeDirectory() {
        var out = await this.exec('cd ~;pwd;')
        return out.stdout
    }

    async whoami() {
        var out = await this.exec('whoami;')
        return out.stdout
    }

    async pwd() {
        var out = await this.exec('pwd;')
        return out.stdout
    }

    // file operators
    async rm(path) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_RM', `removing ${path}`)
        var out = await this.exec(`rm -rf ${path};`)
        return out.stdout    
    }

    async zip(from: string, to: string) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_ZIP', `zipping ${from} to ${to}`)
        var out = await this.exec(`zip -j -r ${to} ${path.basename(from)}`, {
            cwd: path.dirname(from)
        })
        return out.stdout
    }

    async unzip(from: string, to: string) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_UNZIP', `unzipping ${from} to ${to}`)
        var out = await this.exec(`unzip -o ${from} -d ${to}`)
        return out.stdout  
    }

    async tar(from: string, to: string) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_TAR', `taring ${from} to ${to}`)
        to = to.endsWith('.tar') ? to : to + '.tar'
        var out = await this.exec(`tar cf ${to} *`, {
            cwd: from
        })
        return out.stdout
    }

    async untar(from: string, to: string) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_UNTAR', `untaring ${from} to ${to}`)
        var out = await this.exec(`tar -C ${to} -xvf ${from}`)
        return out.stdout
    }
}

export default BaseConnector