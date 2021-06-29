import { Job } from "../models/Job"
import { options, hpcConfig, SSH } from "../types"
import { ConnectorError } from '../errors'
import BaseMaintainer from '../maintainers/BaseMaintainer'
import { BaseFolder, LocalFolder } from '../FileSystem'
import * as path from 'path'
import { config } from "../../configs/config"
import Helper from '../Helper'

class BaseConnector {
    /** parent pointer **/
    public maintainer: BaseMaintainer

    /** properties **/
    public jobID: string

    public hpcName: string

    /** config **/
    public config: hpcConfig

    protected envCmd = '#!/bin/bash\n'

    constructor(job: Job, hpcConfig: hpcConfig, maintainer: BaseMaintainer, env: {[keys: string]: any} = {}) {
        this.jobID = job.id
        this.hpcName = job.hpc
        this.config = hpcConfig
        this.maintainer = maintainer

        var envCmd = 'source /etc/profile;'
        for (var i in env) {
            var v = env[i]
            envCmd += `export ${i}=${v};\n`
        }
        this.envCmd = envCmd
    }

    /** actions **/
    ssh(): SSH {
        if (this.config.is_community_account) {
            return this.maintainer.supervisor.jobSSHPool[this.hpcName]
        } else {
            return this.maintainer.supervisor.jobSSHPool[this.jobID]
        }
    }

    async exec(commands: string | Array<string>, options: options = {}, mute = false, continueOnError = false) {
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

                if (maintainer) maintainer.emitLog(o)
            },
            onStderr(o) {
                o = o.toString()
                if (out.stderr != null) out.stderr = o
                    else out.stderr += o

                if (maintainer && !mute) {
                    maintainer.emitLog(o)
                    maintainer.emitEvent('SSH_STDERR', o)
                }
            }
        }, options)

        for (var i in commands) {
            var command = commands[i].trim()
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_RUN', 'running command [' + command + ']')
            await this.ssh().connection.execCommand(this.envCmd + command, opt)
            if (out.stderr != null && !continueOnError) break // behavior similar to &&
        }

        return out
    }

    /** file operators **/
    async download(from: string, to: LocalFolder, mute = false) {
        if (to == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = from.endsWith('.zip') ? from : `${from}.zip`
        var toZipFilePath = `${to.path}.zip`
        await this.zip(from, fromZipFilePath)

        try {
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD', `get file from ${from} to ${to.path}`)
            await this.ssh().connection.getFile(toZipFilePath, fromZipFilePath)
            await this.rm(fromZipFilePath)
            await to.putFileFromZip(toZipFilePath)
        } catch (e) {
            var error = `unable to get file from ${from} to ${to.path}: ` + e.toString()
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

    }

    async upload(from: BaseFolder, to: string, mute = false) {
        if (from == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = await this.maintainer.executableFolder.getZip()
        var toZipFilePath = to.endsWith('.zip') ? to : `${to}.zip`
        var toFilePath = to.endsWith('.zip') ? to.replace('.zip', '') : to

        try {
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_SCP_UPLOAD', `put file from ${from.path} to ${to}`)
            await this.ssh().connection.putFile(fromZipFilePath, toZipFilePath)
        } catch (e) {
            var error = `unable to put file from ${fromZipFilePath} to ${toZipFilePath}: ` + e.toString()
            if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_SCP_UPLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

        await this.unzip(toZipFilePath, toFilePath)
        await this.createFile(Helper.job2object(this.maintainer.job), path.join(to, 'job.json'))
        await this.rm(toZipFilePath)
    }

    /** helpers **/

    // getters
    async homeDirectory(options: options = {}, mute = false) {
        var out = await this.exec('cd ~;pwd;', options, mute)
        return out.stdout
    }

    async whoami(options: options = {}, mute = false) {
        var out = await this.exec('whoami;', options, mute)
        return out.stdout
    }

    async pwd(path: string = undefined, options: options = {}, mute = false) {
        var cmd = 'pwd;'
        if (path) cmd  = 'cd ' + path + ';' + cmd
        var out = await this.exec(cmd, options, mute)
        return out.stdout
    }

    async ls(path: string = undefined, options: options = {}, mute = false) {
        var cmd = 'ls;'
        if (path) cmd  = 'cd ' + path + ';' + cmd
        var out = await this.exec(cmd, options, mute)
        return out.stdout
    }

    async cat(path: string, options: options = {}, mute = false) {
        var cmd = 'cat ' + path
        var out = await this.exec(cmd, options, mute)
        return out.stdout
    }

    // file operators
    async rm(path: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_RM', `removing ${path}`)
        var out = await this.exec(`rm -rf ${path};`, options, true)
        return out.stdout
    }

    async mkdir(path: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_MKDIR', `removing ${path}`)
        var out = await this.exec(`mkdir -p ${path};`, options, true)
        return out.stdout
    }

    async zip(from: string, to: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_ZIP', `zipping ${from} to ${to}`)
        var out = await this.exec(`zip -q -j -r ${to} . ${path.basename(from)}`, Object.assign({
            cwd: from
        }, options), true)
        return out.stdout
    }

    async unzip(from: string, to: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_UNZIP', `unzipping ${from} to ${to}`)
        var out = await this.exec(`unzip -o -q ${from} -d ${to}`, options, true)
        return out.stdout  
    }

    async tar(from: string, to: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_TAR', `taring ${from} to ${to}`)
        to = to.endsWith('.tar') ? to : to + '.tar'
        var out = await this.exec(`tar cf ${to} *`, Object.assign({
            cwd: from
        }, options), true)
        return out.stdout
    }

    async untar(from: string, to: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_UNTAR', `untaring ${from} to ${to}`)
        var out = await this.exec(`tar -C ${to} -xvf ${from}`, options, true)
        return out.stdout
    }

    async createFile(content: string | Object, path: string, options: options = {}, mute = false) {
        if (this.maintainer != null && !mute) this.maintainer.emitEvent('SSH_CREATE_FILE', `create file to ${path}`)
        if (typeof content != 'string') {
            content = JSON.stringify(content)
        }
        var out = await this.exec(`touch ${path}; echo "${content}" >> ${path}`, options, true)
        return out.stdout
    }
}

export default BaseConnector