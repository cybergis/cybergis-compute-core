import { Event } from "../src/models/Event";
import { Log } from "../src/models/Log";
import { Job } from "../src/models/Job";
import { config } from "../configs/config";
import {
  ConnectionOptions,
  getConnection,
  Connection,
  createConnection,
} from "typeorm";
import { Git } from "./models/Git";
import { GlobusTransferRefreshToken } from "./models/GlobusTransferRefreshToken";
import { Folder } from "./models/Folder";

const entities = [Event, Log, Job, Git, GlobusTransferRefreshToken, Folder];

/**
 * Connection helper class as a wrapper around TypeORM Connection
 */
class DB {
  /** @private */
  private config: ConnectionOptions = {
    name: "default",
    type: "mysql",
    host: config.mysql.host,
    port: config.mysql.port,
    username: config.mysql.username,
    password: config.mysql.password,
    database: config.mysql.database,
    synchronize: true,
    logging: false,
    migrationsRun: true,
    entities: entities,
    cache: {
      type: "redis",
      options: {
        host: config.redis.host,
        port: config.redis.port,
        // TODO: add password support
      },
      ignoreErrors: true,
    },
  };

  /**
   * Construct DB connection class
   * @param {boolean} withCache [use Redis cache to buffer data]
   */
  constructor(withCache = true) {
    if (config.is_jest) {
      this.config = {
        name: "default",
        type: "better-sqlite3",
        database: ":memory:",
        dropSchema: true,
        synchronize: true,
        logging: false,
        entities,
      };
    } else if (!withCache) {
      this.config = {
        name: "default",
        type: "mysql",
        host: config.mysql.host,
        port: config.mysql.port,
        username: config.mysql.username,
        password: config.mysql.password,
        database: config.mysql.database,
        synchronize: true,
        logging: false,
        migrationsRun: true,
        entities: entities,
      };
    }
  }

  /**
   * Use existing Connection or create new one if no Connection exists
   * @returns {Promise<Connection>} TypeORM connection object
   */
  async connect(): Promise<Connection> {
    try {
      return await getConnection(this.config.name);
    } catch (error) {
      return await createConnection(this.config);
    }
  }

  /**
   * Close TypeORM Connection
   */
  async close() {
    await (await this.connect()).close();
  }

  async clearAll() {
    try {
      for (const entity of entities) {
        const connection = await this.connect();
        const repository = await connection.getRepository(entity);
        await repository.clear();
      }
    } catch (error) {
      throw new Error(`ERROR: Cleaning test db: ${error}`);
    }
  }
}

export default DB;
