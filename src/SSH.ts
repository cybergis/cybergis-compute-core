import { options } from './types'
import constant from './constant'
import BaseMaintainer from './maintainers/BaseMaintainer'
const NodeSSH = require('node-ssh')

class SSH {
    private SSH

    private user

    private password

    private ip

    private port

    private privateKey

    private loggedIn = false

    private isCommunityAccount = false

    private passphrase

    private env = ''

    private maintainer

    constructor(destination: string, user: string, password: string = null, maintainer: BaseMaintainer = null) {
        this.SSH = new NodeSSH()
        this.user = user
        this.password = password
        this.maintainer = maintainer

        var server = constant.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        if (server.isCommunityAccount) {
            this.isCommunityAccount = true
            if (server.communityAccountSSH.useLocalKeys) {
                var config = require('../config.json')
                this.privateKey = config.privateKeyPath
                this.passphrase = config.passphrase
            } else {
                this.privateKey = server.communityAccountSSH.key.privateKey
                this.passphrase = server.communityAccountSSH.key.passphrase
            }
        }

        this.ip = server.ip
        this.port = server.port
    }

    async connect(env = {}) {
        if (this.loggedIn) {
            return
        }

        try {
            if (this.isCommunityAccount) {
                await this.SSH.connect({
                    host: this.ip,
                    port: this.port,
                    username: this.user,
                    privateKey: this.privateKey,
                    passphrase: this.passphrase
                })
            } else {
                await this.SSH.connect({
                    host: this.ip,
                    port: this.port,
                    username: this.user,
                    password: this.password
                })
            }
            this.loggedIn = true

            if (this.maintainer != null) {
                this.maintainer.emitEvent('SSH_CONNECTION', 'successfully connected to server [' + this.ip + ':' + this.port + ']')
            }

            var envCmd = 'source /etc/profile;'
            for (var i in env) {
                var v = env[i]
                envCmd += 'export ' + i + '=' + v + ';'
            }

            this.env = envCmd
        } catch (e) {
            if (this.maintainer != null) {
                this.maintainer.emitEvent('SSH_CONNECTION_ERROR', 'connection to server [' + this.ip + ':' + this.port + '] failed with error: ' + e)
            }
            this.loggedIn = false
        }
    }

    async stop() {
        if (this.maintainer != null) {
            this.maintainer.emitEvent('SSH_DISCONNECTION', 'disconnected with server [' + this.ip + ':' + this.port + ']')
        }
        await this.SSH.dispose()
    }

    isConnected() {
        return this.loggedIn
    }

    async exec(commands, options: options = {}, context = null) {
        var out = []

        var lastOut = {
            stage: 0,
            cmd: null,
            stdout: null,
            stderr: null,
            executionFailure: null,
            flags: [],
            isFirstCmd: true,
        }

        var nextOut = {
            stage: null,
            cmd: null,
            stdout: null,
            stderr: null,
            executionFailure: null,
            flags: [],
            isFirstCmd: false,
        }

        var maintainer = this.maintainer

        var opt = Object.assign({
            onStdout(out) {
                var stdout = out.toString()
                if (nextOut.stdout === null) {
                    nextOut.stdout = stdout
                } else {
                    nextOut.stdout += stdout
                }

                if (maintainer != null) {
                    maintainer.emitLog(stdout)
                }

                var parsedStdout = stdout.split('@')
                for (var i in parsedStdout) {
                    var f = parsedStdout[i].match(/flag=\[[\s\S]*\]/g)
                    if (f != null) {
                        f.forEach((v, i) => {
                            v = v.replace('flag=[', '')
                            v = v.replace(/]$/g, '')
                            var e = v.split(':')

                            nextOut.flags.push({
                                type: e[0],
                                message: e[1]
                            })

                            if (maintainer != null) {
                                maintainer.emitEvent(e[0], e[1])
                            }
                        })
                    }
                }
            },
            onStderr(out) {
                var stderr = out.toString()
                if (nextOut.stderr === null) {
                    nextOut.stderr = stderr
                } else {
                    nextOut.stderr += stderr
                }

                if (maintainer != null) {
                    maintainer.emitLog(stderr)
                }
            }
        }, options)

        for (var i in commands) {
            var command = commands[i]
            var cmd

            nextOut.stage = lastOut.stage + 1

            if (typeof command === 'string') {
                cmd = command
            } else {
                try {
                    cmd = command(lastOut, context)
                } catch (e) {
                    nextOut.executionFailure = e
                    if (this.maintainer != null) {
                        this.maintainer.emitEvent('SSH_EXECUTION_ERROR', e)
                    }
                    out.push(nextOut)
                    break
                }
            }

            nextOut.cmd = cmd
            await this.SSH.execCommand(this.env + cmd, opt)
            lastOut = nextOut
            out.push(nextOut)
            nextOut = {
                stage: null,
                cmd: null,
                stdout: null,
                stderr: null,
                executionFailure: null,
                flags: [],
                isFirstCmd: false,
            }
        }

        return out
    }

    async putFile(from: string, to: string) {
        try {
            await this.SSH.putFile(from, to)
        } catch (e) {
            throw new Error('unable to put file: ' + e.toString())
        }
    }

    async getRemoteHomePath() {
        var out = await this.SSH.execCommand(this.env + 'cd ~;pwd;')
        return out['stdout']
    }

    async putDirectory(from: string, to: string, validate = null) {
        try {
            var out = {
                failed: [],
                successful: []
            }

            var opts = {
                recursive: true,
                concurrency: 10,
                tick: function (localPath, remotePath, error) {
                    if (error) {
                        out.failed.push(localPath)
                    } else {
                        out.successful.push(localPath)
                    }
                }
            }

            if (validate != null) {
                opts['validate'] = validate
            }

            await this.SSH.putDirectory(from, to, opts)

            return out
        } catch (e) {
            throw new Error('unable to put directory: ' + e.toString())
        }
    }
}

export default SSH