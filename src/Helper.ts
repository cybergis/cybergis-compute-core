import { manifest } from './types'
const { execSync } = require('child_process')

var Helper = {
    btoa(target: string): string {
        return Buffer.from(target, 'base64').toString('binary')
    },

    atob(target: string): string {
        return Buffer.from(target).toString('base64')
    },

    hideCredFromManifest(manifest: manifest) {
        var out = {}

        for (var i in manifest) {
            if (i != 'cred') {
                out[i] = manifest[i]
            }
        }

        return out
    },

    randomStr(length): string {
        var result = ''
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength))
        }
        return result
    },

    setupFirewallRules(rules: Array<string | Array<string>>, sys: 'linux') {
        if (sys == 'linux') {
            for (var i in rules) {
                var rule = rules[i]
                var t = ''
                var r = ''

                if (Array.isArray(rule)) {
                    t = rule[0] + ' '
                    r = rule[1]
                } else {
                    r = rule
                }

                try {
                    execSync('iptables ' + t + '-D ' + r, {
                        stdio: 'ignore'
                    })
                } catch (e) {
                    //
                }

                try {
                    execSync('iptables ' + t + '-A ' + r, {
                        stdio: 'ignore'
                    })
                } catch (err) {
                    console.error('error occurred when adding rule ' + 'iptables ' + t + '-A ' + r)
                    console.error(err.toString())
                }
            }
        }
    },

    teardownFirewallRules(rules: Array<string | Array<string>>, sys: 'linux') {
        if (sys == 'linux') {
            for (var i in rules) {
                var rule = rules[i]
                var t = ''
                var r = ''

                if (Array.isArray(rule)) {
                    t = rule[0] + ' '
                    r = rule[1]
                } else {
                    r = rule
                }

                try {
                    execSync('iptables ' + t + '-D ' + r, {
                        stdio: 'ignore'
                    })
                } catch (e) {
                    //
                }
            }
        }
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