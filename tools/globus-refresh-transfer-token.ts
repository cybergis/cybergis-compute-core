import { hpcConfigMap } from '../configs/config'
import DB from '../src/DB'
import PythonUtil from '../src/lib/PythonUtil'
import { GlobusTransferRefreshToken } from '../src/models/GlobusTransferRefreshToken'

var main = async () => {
    const db = new DB(false)

    var identities = []
    for (var i in hpcConfigMap) {
        if (hpcConfigMap[i].globus) {
            if (!(hpcConfigMap[i].globus.identity in identities)) {
                identities.push(hpcConfigMap[i].globus.identity)
            }
        }
    }

    var connection = await db.connect()

    var counter = 0
    for (var i in identities) {
        var identity = identities[i]
        if (counter > 0) console.log(`⚠️ please logout of globus before logging into a new identity`)
        console.log(`refreshing transfer refresh token for ${identity}...`)

        var out = await PythonUtil.runInteractive('globus_refresh_transfer_token.py', [], ['transfer_refresh_token'])

        if (out['transfer_refresh_token']) {
            var globusTransferRefreshTokenRepo = connection.getRepository(GlobusTransferRefreshToken)
            var g = new GlobusTransferRefreshToken()
            g.identity = identity
            g.transferRefreshToken = out['transfer_refresh_token']
            await globusTransferRefreshTokenRepo.save(g)
        }

        counter++
    }

    await db.close()
}

main()