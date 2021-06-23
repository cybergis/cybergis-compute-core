import Helper from "./Helper"
import { rawAccessToken } from './types'

class JAT {
    private secretToken = null

    private algorithm = null

    private id

    private algorithmName = null

    private algorithms: {[keys: string]: any} = {}

    init(algorithm: string, id: string, secretToken: string): this {
        try {
            if (!this.algorithms[algorithm]) this.algorithms[algorithm] = require('crypto-js/' + algorithm)
        } catch {
            throw Error('encryption algorithm not supported by crypto-js package, please refer to https://github.com/brix/crypto-js')
        }
        this.algorithm = this.algorithms[algorithm]
        this.algorithmName = algorithm
        this.secretToken = secretToken
        this.id = id
        return this
    }

    parseAccessToken(accessToken: string): rawAccessToken {
        var aT = accessToken.split('.')
        if (aT.length != 4) {
            throw Error('invalid accessToken')
        }

        return {
            alg: this._decodeStr(aT[0]),
            payload: {
                encoded: aT[1],
                decoded: this._decodeJSON(aT[1])
            },
            id: this._decodeStr(aT[2]),
            hash: aT[3],
        }
    }

    hash(payload: string): string {
        this._checkInit()
        return this.algorithm(this.secretToken + this.id + payload).toString()
    }

    getDate(): number {
        return this._date()
    }

    private _date(): number {
        // trust accessToken for an hour
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

    private _decodeJSON(target: string) {
        return JSON.parse(Helper.btoa(target))
    }

    private _decodeStr(target: string): string {
        return Helper.btoa(target)
    }

    private _checkInit() {
        if (!this.algorithm || !this.secretToken || !this.algorithmName || !this.id) {
            throw Error('please init object before getting accessToken')
        }
    }
}

export default JAT