import { options } from './types'
import Constants from './constant'
const NodeSSH = require('node-ssh')
var ssh = new NodeSSH()

var Helper = {
    btoa(target: string): string {
        return Buffer.from(target, 'base64').toString('binary')
    },

    atob(target: string): string {
        return Buffer.from(target).toString('base64')
    },

    async checkSSHLogin(destination: string, user: string, password: string) {
        var server = Constants.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        try {
            await ssh.connect({
                host: server.ip,
                port: server.port,
                username: user,
                password: password
            })

            await ssh.dispose()

            return true
        } catch (e) {
            return false
        }
    },

    async ssh(destination: string, user: string, password: string, commands: Array<string>, options: options = {}) {
        var server = Constants.destinationMap[destination]

        if (server === undefined) {
            throw Error('cannot identify server from destination name ' + destination)
        }

        await ssh.connect({
            host: server.ip,
            port: server.port,
            username: user,
            password: password
        })

        var opt = Object.assign({
            onStdout(out) {
                if (o.out === null) {
                    o.out = out.toString()
                } else {
                    o.out += out.toString()
                }
            },
            onStderr(out) {
                if (o.error === null) {
                    o.error = out.toString()
                } else {
                    o.error += out.toString()
                }
            }
        }, options)

        var out = []

        for (var i in commands) {
            var cmd = commands[i]

            var o = {
                cmd: cmd,
                out: null,
                error: null
            }

            await ssh.execCommand(cmd, opt)

            out.push(o)
        }

        await ssh.dispose()

        return out
    },

    randomStr(length) {
        var result = ''
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^&*'
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength))
        }
        return result
    },

    onExit(callback) {
        //do something when app is closing
        process.on('exit', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        //catches ctrl+c event
        process.on('SIGINT', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('SIGUSR2', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('SIGTERM', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })

        process.on('uncaughtException', function () {
            callback()
            setTimeout(function () {
                process.exit(1)
            }, 3 * 1000)
        })
    },

    consoleEnd: '\x1b[0m',

    consoleGreen: '\x1b[32m'
}

export default Helper