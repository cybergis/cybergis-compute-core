import { options } from './types'
import constant from './constant'
const NodeSSH = require('node-ssh')

class SSH {
    private SSH

    private destination

    private user

    private password

    private ip

    private port

    private loggedIn = false

    constructor(destination: string, user: string, password: string) {
        this.SSH = new NodeSSH()
        this.destination = destination
        this.user = user
        this.password = password

        var server = constant.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        this.ip = server.ip
        this.port = server.port
    }

    async connect() {
        try {
            await this.SSH.connect({
                host: this.ip,
                port: this.port,
                username: this.user,
                password: this.password
            })
            this.loggedIn = true
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
            cmd: null,
            out: null,
            error: null,
            isFirstCmd: true
        }

        var nextOut = {
            cmd: null,
            out: null,
            error: null,
            isFirstCmd: false
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
            if (typeof command === 'string') {
                cmd = command
            } else {
                cmd = command(lastOut)
            }
            nextOut.cmd = cmd
            await this.SSH.execCommand(cmd, opt)
            out.push(nextOut)
            lastOut = nextOut
            nextOut = {
                cmd: null,
                out: null,
                error: null,
                isFirstCmd: false
            }
        }

        return out
    }
}

export default SSH