import { Command } from 'commander'
import { Git } from './src/models/Git'
import { hpcConfigMap } from './configs/config'
import DB from './src/DB'
import PythonUtil from './src/lib/PythonUtil'
import { config } from './configs/config'
import { createInterface } from "readline"
import { GlobusTransferRefreshToken } from './src/models/GlobusTransferRefreshToken'

var pkg = require('../package.json')
const readline = createInterface({
    input: process.stdin,
    output: process.stdout
})

function ask(question: string): Promise<string> {
    return new Promise((resolve, reject) => {
        readline.question(question, (input: string) => resolve(input) );
    });
}

var cmd = new Command()

cmd.version(pkg.version)

cmd.command('git <operation>')
    .option('-i, --id <id>', '[operation=add/update/delete/approve] git repository\'s id')
    .option('-a, --address <address>', '[operation=add/update] git repository\'s address')
    .option('-s, --sha <sha>', '[operation=add/update] git repository\'s sha hash')
    .action(async (operation: string, cmd) => {
        const db = new DB(false)
        switch (operation) {
            case 'add':
                var git = new Git()
                if (cmd.address && cmd.id) {
                    git.address = cmd.address
                    git.id = cmd.id
                } else {
                    console.error('-a, --address <address> and -i, --id <id> flags is required'); return
                }
                git.isApproved = true
                if (cmd.sha) git.sha = cmd.sha
                var connection = await db.connect()
                var gitRepo = connection.getRepository(Git)
                await gitRepo.save(git)
                console.log('git successfully added:')
                console.log(git)
                break
            case 'update':
                if (!cmd.id) { console.error('-i, --id <id> flag is required'); return }
                var connection = await db.connect()
                var i = {}
                if (cmd.address) i['address'] = cmd.address
                if (cmd.sha) i['sha'] = cmd.sha
                await connection.createQueryBuilder()
                    .update(Git)
                    .where('id = :id', { id:  cmd.id })
                    .set(i)
                    .execute()
                console.log('git successfully updated:')
                var gitRepo = connection.getRepository(Git)
                console.log(await gitRepo.findOne(cmd.id))
                break
            case 'approve':
                if (!cmd.id) { console.error('-i, --id <id> flag is required'); return }
                var connection = await db.connect()
                await connection.createQueryBuilder()
                    .update(Git)
                    .where('id = :id', { id:  cmd.id })
                    .set({ isApproved: true })
                    .execute()
                console.log('git approved')
                break
            case 'delete':
                if (!cmd.id) { console.error('-i, --id <id> flag is required'); return }
                var gitRepo = connection.getRepository(Git)
                await gitRepo.delete(cmd.id)
                console.log('git successfully deleted')
                break
            default:
                console.error('<operation> invalid operation, only support [add/update/delete/approve]')
                break
        }
        await db.close()
    })

cmd.command('globus-refresh-transfer-token')
    .action(async (operation: string, cmd) => {
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

        for (var i in identities) {
            var identity = identities[i]
            console.log(`⚠️ refreshing transfer refresh token for ${identity}...`)

            var out = await PythonUtil.runPython('globus_get_auth_url.py', [config.globus_client_id], ['auth_url'])
            console.log(`please go to this URL and login with identity ${identity}: \n\n`)
            console.log(out['auth_url'])

            var authCode = await ask('Please enter the code you get after login here: ')
            var out = await PythonUtil.runPython('globus_get_transfer_refresh_token_from_auth_code.py', [config.globus_client_id, authCode], ['transfer_refresh_token'])
            var transferRefreshToken = out['transfer_refresh_token']

            var globusTransferRefreshTokenRepo = connection.getRepository(GlobusTransferRefreshToken)
            var g = new GlobusTransferRefreshToken()
            g.identity = identity
            g.transferRefreshToken = transferRefreshToken
            await globusTransferRefreshTokenRepo.save(g)
        }

        await db.close()
    })

cmd.parse(process.argv)