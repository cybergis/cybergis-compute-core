import JAT from './JAT'
import Helper from './Helper'
import { manifest, aT } from './types'
import SSH from './SSH'
import constant from './constant'
const config = require('../config.json')

class Guard {
    private secretTokens = {}

    private jat = new JAT()

    private authenticatedAccessTokenCache = {}

    private uidCounter = 0

    async issueSecretTokenViaSSH(destination: string, user: string, password: string): Promise<string> {
        this._clearCache()
        var ssh = new SSH(destination, user, password)
        await ssh.connect()
        var isValid = ssh.isConnected()
        await ssh.stop()

        if (!isValid) {
            throw new Error('unable to check credentials with ' + destination)
        }

        var secretToken = Helper.randomStr(45)

        while (this.secretTokens[secretToken] != undefined) {
            secretToken = Helper.randomStr(45)
        }

        this.uidCounter += 1
        this.secretTokens[secretToken] = {
            cred: {
                usr: user,
                pwd: password
            },
            dest: destination,
            sT: secretToken,
            uid: this.uidCounter
        }

        return secretToken
    }

    issueSecretTokenViaWhitelist(destination: string, user: string, requestIP: string) {
        this._clearCache()

        if (!constant.whitelistIPs.includes(requestIP) && !config.isTesting) {
            throw new Error('ip ' + requestIP + ' is not in whitelist')
        }

        var secretToken = Helper.randomStr(45)

        while (this.secretTokens[secretToken] != undefined) {
            secretToken = Helper.randomStr(45)
        }

        this.uidCounter += 1
        this.secretTokens[secretToken] = {
            cred: {
                usr: user,
                pwd: null
            },
            dest: destination,
            sT: secretToken,
            uid: this.uidCounter
        }

        return secretToken
    }

    validateAccessToken(manifest: manifest | aT): manifest | aT {
        this._clearCache()

        var rawAT = this.jat.parseAccessToken(manifest.aT)
        var date = this.jat.getDate()

        if (rawAT.payload.decoded.date != date) {
            throw new Error('invalid accessToken provided')
        }

        if (this.authenticatedAccessTokenCache[date] != undefined) {
            var cache = this.authenticatedAccessTokenCache[date][rawAT.hash]
            if (cache != undefined) {
                delete manifest.aT
                manifest.cred = cache.cred
                manifest.uid = cache.uid
                return manifest
            }
        }

        for (var i in this.secretTokens) {
            var secretToken = this.secretTokens[i]
            if (secretToken.dest === manifest.dest || manifest.dest === undefined) {
                var hash: string = this.jat.init(rawAT.alg, secretToken.sT).hash(rawAT.payload.encoded)
                if (hash == rawAT.hash) {
                    if (this.authenticatedAccessTokenCache[date] === undefined) {
                        this.authenticatedAccessTokenCache[date] = {}
                    }
                    this.authenticatedAccessTokenCache[date][rawAT.hash] = {
                        cred: secretToken.cred,
                        uid: secretToken.uid
                    }
                    delete manifest.aT
                    manifest.cred = secretToken.cred
                    manifest.uid = secretToken.uid
                    return manifest
                }
            }
        }

        throw new Error('invalid accessToken provided')
    }

    revokeSecretToken(secretToken: string) {
        delete this.secretTokens[secretToken]
    }

    private async _clearCache() {
        var date = this.jat.getDate()
        for (var i in this.authenticatedAccessTokenCache) {
            if (parseInt(i) < date) {
                delete this.authenticatedAccessTokenCache[i]
            }
        }
    }
}

export default Guard