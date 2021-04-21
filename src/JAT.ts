import Helper from "./Helper"
import { rawAccessToken } from './types'

class JAT {
    private accessTokenCache = {}

    private secretToken = null

    private algorithm = null

    private algorithmName = null

    init(algorithm: string, secretToken: string): this {
        try {
            this.algorithm = require('crypto-js/' + algorithm)
        } catch {
            throw Error('encryption algorithm not supported by crypto-js package, please refer to https://github.com/brix/crypto-js')
        }
        this.algorithmName = algorithm
        this.secretToken = secretToken
        this.accessTokenCache = {}
        return this
    }

    getAccessToken(): string {
        this._checkInit()

        var date = this._date()
        var accessToken = this.accessTokenCache[date]

        if (accessToken == undefined) {
            var payload = this._encodeJSON({
                date: date
            })
            var alg = this._encodeStr(this.algorithmName)
            var hash = this.hash(payload)
            accessToken = alg + '.' + payload + '.' + hash
            this.accessTokenCache[date] = accessToken
            this._clearCache()
        }

        return accessToken
    }

    parseAccessToken(accessToken: string): rawAccessToken {
        var aT = accessToken.split('.')
        if (aT.length != 3) {
            throw Error('invalid accessToken')
        }

        return {
            alg: this._decodeStr(aT[0]),
            payload: {
                encoded: aT[1],
                decoded: this._decodeJSON(aT[1])
            },
            hash: aT[2]
        }
    }

    hash(payload: string): string {
        return this.algorithm(this.secretToken + payload).toString()
    }

    getDate(): number {
        return this._date()
    }

    private async _clearCache() {
        var date = this._date()
        for (var i in this.accessTokenCache) {
            if (parseInt(i) < date) {
                delete this.accessTokenCache[i]
            }
        }
    }

    private _date(): number {
        // trust for an accessToken is established in the confine of an hour
        var current = new Date()

        var y = current.getUTCFullYear()
        var m = current.getUTCMonth() + 1
        var d = current.getUTCDate()
        var h = current.getUTCHours()

        var mStr = m < 10 ? '0' + m.toString() : m.toString()
        var dStr = d < 10 ? '0' + d.toString() : d.toString()
        var hStr = h < 10 ? '0' + h.toString() : h.toString()

        return parseInt(y + mStr + dStr + hStr)
    }

    private _encodeJSON(target): string {
        return Helper.atob(JSON.stringify(target))
    }

    private _decodeJSON(target: string) {
        return JSON.parse(Helper.btoa(target))
    }

    private _encodeStr(target: string): string {
        return Helper.atob(target)
    }

    private _decodeStr(target: string): string {
        return Helper.btoa(target)
    }

    private _checkInit() {
        if (this.algorithm == null || this.secretToken == null || this.algorithmName == null) {
            throw Error('please init object before getting accessToken')
        }
    }
}

export default JAT