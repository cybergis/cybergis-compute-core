import { Event } from '../src/models/Event'
import { Log } from '../src/models/Log'
import { Job } from '../src/models/Job'
import { config } from '../configs/config'
import { ConnectionOptions, getConnection, Connection, createConnection } from 'typeorm'

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
        cache: {
            type: "redis",
            options: {
                host: config.redis.host,
                port: config.redis.port
                // TODO: add password support
            },
            ignoreErrors: true
        },
        migrationsRun: true,
        entities: [Event, Log, Job]
    }

    async connect(): Promise<Connection> {
        try {
            return await getConnection(this.config.name)
        } catch (error) {
            return await createConnection(this.config)
        }
    }
}

export default DB