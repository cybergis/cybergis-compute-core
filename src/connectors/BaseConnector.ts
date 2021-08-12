import { Job } from "../models/Job"
import { options, hpcConfig, SSH } from "../types"
import { ConnectorError } from '../errors'
import BaseMaintainer from '../maintainers/BaseMaintainer'
import { GlobusFolder, LocalFolder } from '../FileSystem'
import * as path from 'path'

class BaseConnector {
    /** parent pointer **/
    public maintainer: BaseMaintainer

    /** properties **/
    public jobID: string

    public hpcName: string

    public remote_executable_folder_path: string

    public remote_data_folder_path: string

    public remote_result_folder_path: string

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
        this.remote_executable_folder_path = path.join(this.config.root_path, this.maintainer.id, 'executable')
        this.remote_data_folder_path = path.join(this.config.root_path, this.maintainer.id, 'data')
        this.remote_result_folder_path = path.join(this.config.root_path, this.maintainer.id, 'result')
    }

    /** actions **/
    ssh(): SSH {
        if (this.config.is_community_account) {
            return this.maintainer.supervisor.jobSSHPool[this.hpcName]
        } else {
            return this.maintainer.supervisor.jobSSHPool[this.jobID]
        }
    }

    async exec(commands: string | Array<string>, options: options = {}, muteEvent = true, muteLog = true, continueOnError = false) {
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
                if (out.stdout === null) out.stdout = o
                    else out.stdout += o

                if (maintainer && !muteLog) maintainer.emitLog(o)
            },
            onStderr(o) {
                o = o.toString()
                if (out.stderr === null) out.stderr = o
                    else out.stderr += o

                    if (maintainer && !muteLog) maintainer.emitLog(o)
                    if (maintainer && !muteEvent) maintainer.emitEvent('SSH_STDERR', o)
            }
        }, options)

        for (var i in commands) {
            var command = commands[i].trim()
            if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_RUN', 'running command [' + command + ']')
            await this.ssh().connection.execCommand(this.envCmd + command, opt)
            if (out.stderr && !continueOnError) break // behavior similar to &&
        }

        return out
    }

    /** file operators **/
    async download(from: string, to: LocalFolder, muteEvent = false) {
        if (to == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = from.endsWith('.zip') ? from : `${from}.zip`
        var toZipFilePath = `${to.path}.zip`
        await this.zip(from, fromZipFilePath)

        try {
            if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD', `get file from ${from} to ${to.path}`)
            await this.ssh().connection.getFile(toZipFilePath, fromZipFilePath)
            await this.rm(fromZipFilePath)
            await to.putFileFromZip(toZipFilePath)
        } catch (e) {
            var error = `unable to get file from ${from} to ${to.path}: ` + e.toString()
            if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_SCP_DOWNLOAD_ERROR', error)
            throw new ConnectorError(error)
        }
    }

    async upload(from: LocalFolder, to: string, muteEvent = false) {
        if (from == undefined) throw new ConnectorError('please init input file first')
        var fromZipFilePath = await this.maintainer.executableFolder.getZip()
        var toZipFilePath = to.endsWith('.zip') ? to : `${to}.zip`
        var toFilePath = to.endsWith('.zip') ? to.replace('.zip', '') : to

        try {
            if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_SCP_UPLOAD', `put file from ${from.path} to ${to}`)
            await this.ssh().connection.putFile(fromZipFilePath, toZipFilePath)
        } catch (e) {
            var error = `unable to put file from ${fromZipFilePath} to ${toZipFilePath}: ` + e.toString()
            if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_SCP_UPLOAD_ERROR', error)
            throw new ConnectorError(error)
        }

        await this.unzip(toZipFilePath, toFilePath)
        await this.rm(toZipFilePath)
    }

    async transferGlobus(from: GlobusFolder, to: GlobusFolder) {
        
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
    async rm(path: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_RM', `removing ${path}`)
        var out = await this.exec(`rm -rf ${path};`, options)
        return out.stdout
    }

    async mkdir(path: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_MKDIR', `removing ${path}`)
        var out = await this.exec(`mkdir -p ${path};`, options)
        return out.stdout
    }

    async zip(from: string, to: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_ZIP', `zipping ${from} to ${to}`)
        var out = await this.exec(`zip -q -j -r ${to} . ${path.basename(from)}`, Object.assign({
            cwd: from
        }, options))
        return out.stdout
    }

    async unzip(from: string, to: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_UNZIP', `unzipping ${from} to ${to}`)
        var out = await this.exec(`unzip -o -q ${from} -d ${to}`, options)
        return out.stdout  
    }

    async tar(from: string, to: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_TAR', `taring ${from} to ${to}`)
        to = to.endsWith('.tar') ? to : to + '.tar'
        var out = await this.exec(`tar cf ${to} *`, Object.assign({
            cwd: from
        }, options))
        return out.stdout
    }

    async untar(from: string, to: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_UNTAR', `untaring ${from} to ${to}`)
        var out = await this.exec(`tar -C ${to} -xvf ${from}`, options)
        return out.stdout
    }

    async createFile(content: string | Object, path: string, options: options = {}, muteEvent = false) {
        if (this.maintainer && !muteEvent) this.maintainer.emitEvent('SSH_CREATE_FILE', `create file to ${path}`)
        if (typeof content != 'string') {
            content = JSON.stringify(content).replace(/(["'])/g, "\\$1")
        } else {
            content = content.replace(/(["'])/g, "\\$1")
        }
        var out = await this.exec(`touch ${path}; echo "${content}" >> ${path}`, options, true)
        return out.stdout
    }

    getRemoteExecutableFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_executable_folder_path, providedPath)
        else return this.remote_executable_folder_path
    }

    getRemoteDataFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_data_folder_path, providedPath)
        else return this.remote_data_folder_path
    }

    getRemoteResultFolderPath(providedPath: string = null): string {
        if (providedPath) return path.join(this.remote_result_folder_path, providedPath)
        else return this.remote_result_folder_path
    }
}

export default BaseConnector