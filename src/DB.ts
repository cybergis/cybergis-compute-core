import { Event } from '../src/models/Event'
import { Log } from '../src/models/Log'
import { Job } from '../src/models/Job'
import { config } from '../configs/config'
import { ConnectionOptions, getConnection, ConnectionManager } from 'typeorm'

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
        entities: [Event, Log, Job]
    }

    async connect() {
        try {
            return await getConnection(this.config.name)
        } catch (error) {
          const connectionManager = new ConnectionManager()
          const connection = connectionManager.create(this.config);
          return await connection.connect()
        }
    }
}

export default DB