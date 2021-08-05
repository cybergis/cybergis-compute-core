import { Command } from 'commander'
import { Git } from './src/models/Git'
import DB from './src/DB'
var pkg = require('../package.json')

var cmd = new Command()

cmd.version(pkg.version)

cmd.command('git <operation>')
    .option('-a, --address <address>', '[operation=add/update/delete/approve] git repository\'s address')
    .option('-s, --sha <sha>', '[operation=add/update] git repository\'s sha hash')
    .action(async (operation: string, cmd) => {
        const db = new DB()
        switch (operation) {
            case 'add':
                var git = new Git()
                if (cmd.address) {
                    git.address = cmd.address
                } else {
                    console.error('-a, --address <address> flag is required'); return
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
                if (!cmd.address) { console.error('-a, --address <address> flag is required'); return }
                var connection = await db.connect()
                await connection.createQueryBuilder()
                    .update(Git)
                    .where('address = :address', { address:  cmd.address })
                    .set({ sha: cmd.sha })
                    .execute()
                console.log('git successfully updated:')
                var gitRepo = connection.getRepository(Git)
                console.log(await gitRepo.findOne(cmd.address))
                break
            case 'approve':
                if (!cmd.address) { console.error('-a, --address <address> flag is required'); return }
                var connection = await db.connect()
                await connection.createQueryBuilder()
                    .update(Git)
                    .where('address = :address', { address:  cmd.address })
                    .set({ isApproved: true })
                    .execute()
                console.log('git approved')
                break
            case 'delete':
                if (!cmd.address) { console.error('-a, --address <address> flag is required'); return }
                var gitRepo = connection.getRepository(Git)
                await gitRepo.delete(cmd.address)
                console.log('git successfully deleted')
                break
            default:
                console.error('<operation> invalid operation, only support [add/update/delete/approve]')
                break
        }
    })