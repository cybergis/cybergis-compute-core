import { Event } from '../src/models/Event'
import { Log } from '../src/models/Log'
import { Job } from '../src/models/Job'
import { config } from '../configs/config'
import { ConnectionOptions, getConnection, Connection, createConnection } from 'typeorm'
import { Git } from './models/Git'
import { GlobusTransferRefreshToken } from './models/GlobusTransferRefreshToken'

class DB {
    private config: ConnectionOptions = {
        name: 'default',
        type: 'mysql',
        host: config.mysql.host,
        port: config.mysql.port,
        username: config.mysql.username,
        password: config.mysql.password,
        database: config.mysql.database,
        synchronize: true,
        logging: false,
        migrationsRun: true,
        entities: [Event, Log, Job, Git],
        cache: {
            type: "redis",
            options: {
                host: config.redis.host,
                port: config.redis.port
                // TODO: add password support
            },
            ignoreErrors: true
        }
    }

    constructor(withCache = true) {
        if (!withCache) {
            this.config = {
                name: 'default',
                type: 'mysql',
                host: config.mysql.host,
                port: config.mysql.port,
                username: config.mysql.username,
                password: config.mysql.password,
                database: config.mysql.database,
                synchronize: true,
                logging: false,
                migrationsRun: true,
                entities: [Event, Log, Job, Git, GlobusTransferRefreshToken]
            }
        }
    }

    async connect(): Promise<Connection> {
        try {
            return await getConnection(this.config.name)
        } catch (error) {
            return await createConnection(this.config)
        }
    }

    async close() {
        await (await this.connect()).close()
    }
}

export default DB