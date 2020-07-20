import { options } from './types'
import constant from './constant'
const NodeSSH = require('node-ssh')

class SSH {
    private SSH

    private user

    private password

    private ip

    private port

    private loggedIn = false

    private env = ''

    constructor(destination: string, user: string, password: string) {
        this.SSH = new NodeSSH()
        this.user = user
        this.password = password

        var server = constant.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        this.ip = server.ip
        this.port = server.port
    }

    async connect(env = {}) {
        try {
            await this.SSH.connect({
                host: this.ip,
                port: this.port,
                username: this.user,
                password: this.password
            })
            this.loggedIn = true

            var envCmd = 'source /etc/profile;'
            for (var i in env) {
                var v = env[i]
                envCmd += 'export ' + i + '=' + v + ';'
            }

            this.env = envCmd
        } catch (e) {
            this.loggedIn = false
        }
    }

    async stop() {
        await this.SSH.dispose()
    }

    isConnected() {
        return this.loggedIn
    }

    async exec(commands, options: options = {}) {
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
                    cmd = command(lastOut)
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
}

export default SSH