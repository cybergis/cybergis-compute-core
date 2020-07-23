import { options } from './types'
import constant from './constant'
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

    constructor(destination: string, user: string, password: string = null) {
        this.SSH = new NodeSSH()
        this.user = user
        this.password = password

        var server = constant.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        if (server.isCommunityAccount) {
            this.isCommunityAccount = true
            var config = require('../config.json')
            this.privateKey = config.privateKeyPath
            this.passphrase = config.passphrase
        }

        this.ip = server.ip
        this.port = server.port
    }

    async connect(env = {}) {
        try {
            if (this.isCommunityAccount) {
                var out = await this.SSH.connect({
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

            var envCmd = 'source /etc/profile;'
            for (var i in env) {
                var v = env[i]
                envCmd += 'export ' + i + '=' + v + ';'
            }

            this.env = envCmd
        } catch (e) {
            console.log(e)
            this.loggedIn = false
        }
    }

    async stop() {
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
            out: null,
            error: null,
            isFirstCmd: true,
            isFail: false
        }

        var nextOut = {
            stage: null,
            cmd: null,
            out: null,
            error: null,
            isFirstCmd: false,
            isFail: false
        }

        var opt = Object.assign({
            onStdout(out) {
                if (nextOut.out === null) {
                    nextOut.out = out.toString()
                } else {
                    nextOut.out += out.toString()
                }
            },
            onStderr(out) {
                if (nextOut.error === null) {
                    nextOut.error = out.toString()
                } else {
                    nextOut.error += out.toString()
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
                    nextOut.error = e
                    nextOut.isFail = true
                    out.push(nextOut)
                    break
                }
            }

            nextOut.cmd = cmd
            await this.SSH.execCommand(this.env + cmd, opt)
            lastOut = nextOut
            delete nextOut.isFirstCmd
            out.push(nextOut)
            nextOut = {
                stage: null,
                cmd: null,
                out: null,
                error: null,
                isFirstCmd: false,
                isFail: false
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