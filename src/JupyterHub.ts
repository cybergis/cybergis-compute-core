import Helper from "./Helper"
import axios from "axios"
import * as path from "path"

declare type decodedToken = {
    host: string
    token: string
}

class JupyterHub {

    private basePath = '/hub/api'

    public async getUsername(token: string) {
        var t = this._decodeToken(token)
        try {
            var res = await axios.get(path.join(`https://${t.host}`, this.basePath, '/user'), {
                headers: { 'Authorization': `token ${t.token}` }
            })
            return `${res.data.name}@${t.host}`
        } catch {
            return undefined
        }
    }

    private _decodeToken(target: string): decodedToken {
        var t = Helper.btoa(target)
        var i = t.split('@')
        if (i.length != 2) {
            throw new Error('JupyterHub Token is formatted ')
        }
        return {
            host: i[0],
            token: i[1]
        }
    }
}

export default JupyterHub