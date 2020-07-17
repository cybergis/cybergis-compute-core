import JAT from './JAT'
import Helper from './Helper'
import { manifest } from './types'
import SSH from './SSH'

class Guard {
    private secretTokens = {}

    private jat = new JAT()

    async issueSecretToken(destination: string, user: string, password: string): Promise<string> {
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
        
        this.secretTokens[secretToken] = {
            cred: {
                usr: user,
                pwd: password
            },
            dest: destination,
            sT: secretToken
        }

        return secretToken
    }

    validateAccessToken(manifest: manifest): manifest {
        var rawAT = this.jat.parseAccessToken(manifest.aT)

        for (var i in this.secretTokens) {
            var secretToken = this.secretTokens[i]
            if (secretToken.dest === manifest.dest) {
                var hash: string = this.jat.init(rawAT.alg, secretToken.sT).hash(rawAT.payload.encoded)
                if (hash == rawAT.hash) {
                    delete manifest.aT
                    manifest.cred = secretToken.cred
                    return manifest
                }
            }
        }

        throw new Error('invalid accessToken provided')
    }

    revokeSecretToken(secretToken: string) {
        delete this.secretTokens[secretToken]
    }
}

export default Guard