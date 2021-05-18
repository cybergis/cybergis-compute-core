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
            this.sshConfig.username = hpcConfig.community_login.user
            if (hpcConfig.community_login.use_local_key) {
                this.sshConfig.privateKey = config.local_key.private_key_path
                if (config.local_key.passphrase) this.sshConfig.passphrase = config.local_key.passphrase
            } else {
                this.sshConfig.privateKey = hpcConfig.community_login.external_key.private_key_path
                if (hpcConfig.community_login.external_key.passphrase)
                    this.sshConfig.passphrase = hpcConfig.community_login.external_key.passphrase
            }
        } else {
            // need support for user upload keys
            this.sshConfig.username = manifest.cred.usr
            this.sshConfig.password = manifest.cred.pwd
        }

        this.maintainer = maintainer
    }

    /** actions **/
    async connect(env = {}) {
        if (this.ssh.isConnected()) return

        try {
            await this.ssh.connect(this.sshConfig)
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_CONNECTION', 'successfully connected to server [' + this.sshConfig.host + ':' + this.sshConfig.port + ']')

            // generate env bash cmd
            var envCmd = 'source /etc/profile;'
            for (var i in env) {
                var v = env[i]
                envCmd += `export ${i}=${v};\n`
            }
            this.envCmd = envCmd
        } catch (e) {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_CONNECTION_ERROR', 'connection to server [' + this.sshConfig.host + ':' + this.sshConfig.port + '] failed with error: ' + e)
        }
    }

    async disconnect() {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_DISCONNECTION', 'disconnected with server [' + this.sshConfig.host + ':' + this.sshConfig.port + ']')
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

        options = Object.assign({
            cwd: this.config.root_path
        }, options)

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
            var command = commands[i].trim()
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_RUN', 'running command [' + command + ']')
            await this.ssh.execCommand(this.envCmd + command, opt)
            if (out.stderr != null && !continueOnError) break // behavior similar to &&
        }

        return out
    }

    /** file operators **/
    async download(from: string, to: LocalFile) {
        if (to == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = from.endsWith('.zip') ? from : `${from}.zip`
        var toZipFilePath = `${to.path}.zip`
        await this.zip(from, fromZipFilePath)

        try {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD', `get file from ${from} to ${to.path}`)
            await this.ssh.getFile(toZipFilePath, fromZipFilePath)
            await this.rm(fromZipFilePath)
            await to.putFromZip(toZipFilePath)
        } catch (e) {
            var error = `unable to get file from ${from} to ${to.path}: ` + e.toString()
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

    }

    async upload(from: LocalFile, to: string) {
        if (from == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = await this.maintainer.executableFile.getZip()
        var toZipFilePath = to.endsWith('.zip') ? to : `${to}.zip`
        var toFilePath = to.endsWith('.zip') ? to.replace('.zip', '') : to

        try {
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_UPLOAD', `put file from ${from.path} to ${to}`)
            await this.ssh.putFile(fromZipFilePath, toZipFilePath)
        } catch (e) {
            var error = `unable to put file from ${fromZipFilePath} to ${toZipFilePath}: ` + e.toString()
            if (this.maintainer != null) this.maintainer.emitEvent('SSH_SCP_UPLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

        await this.unzip(toZipFilePath, toFilePath)
        await this.rm(toZipFilePath)
    }

    /** helpers **/

    // getters
    async homeDirectory(options: options = {}) {
        var out = await this.exec('cd ~;pwd;', options)
        return out.stdout
    }

    async whoami(options: options = {}) {
        var out = await this.exec('whoami;', options)
        return out.stdout
    }

    async pwd(path: string = undefined, options: options = {}) {
        var cmd = 'pwd;'
        if (path) cmd  = 'cd ' + path + ';' + cmd
        var out = await this.exec(cmd, options)
        return out.stdout
    }

    async ls(path: string = undefined, options: options = {}) {
        var cmd = 'ls;'
        if (path) cmd  = 'cd ' + path + ';' + cmd
        var out = await this.exec(cmd, options)
        return out.stdout
    }

    async cat(path: string, options: options = {}) {
        var cmd = 'cat ' + path
        var out = await this.exec(cmd, options)
        return out.stdout
    }

    // file operators
    async rm(path: string, options: options = {}) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_RM', `removing ${path}`)
        var out = await this.exec(`rm -rf ${path};`, options)
        return out.stdout    
    }

    async zip(from: string, to: string, options: options = {}) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_ZIP', `zipping ${from} to ${to}`)
        var out = await this.exec(`zip -q -j -r ${to} . ${path.basename(from)}`, Object.assign({
            cwd: from
        }, options))
        return out.stdout
    }

    async unzip(from: string, to: string, options: options = {}) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_UNZIP', `unzipping ${from} to ${to}`)
        var out = await this.exec(`unzip -o -q ${from} -d ${to}`, options)
        return out.stdout  
    }

    async tar(from: string, to: string, options: options = {}) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_TAR', `taring ${from} to ${to}`)
        to = to.endsWith('.tar') ? to : to + '.tar'
        var out = await this.exec(`tar cf ${to} *`, Object.assign({
            cwd: from
        }, options))
        return out.stdout
    }

    async untar(from: string, to: string, options: options = {}) {
        if (this.maintainer != null) this.maintainer.emitEvent('SSH_UNTAR', `untaring ${from} to ${to}`)
        var out = await this.exec(`tar -C ${to} -xvf ${from}`, options)
        return out.stdout
    }
}

export default BaseConnector