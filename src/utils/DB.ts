import {
  DataSourceOptions,
  DataSource,
} from "typeorm";

import { config } from "../../configs/config";
import * as Helper from "../helpers/Helper"; 
import { Cache } from "../models/Cache";
import { Event } from "../models/Event";
import { Folder } from "../models/Folder";
import { Git } from "../models/Git";
import { GlobusTransferRefreshToken } from "../models/GlobusTransferRefreshToken";
import { Job } from "../models/Job";
import { Log } from "../models/Log";

const entities = [Cache, Event, Folder, Git, GlobusTransferRefreshToken, Job, Log];

let dbConfig: DataSourceOptions = {
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
    }
  },
};

if (config.is_jest) {
  dbConfig = {
    name: "default",
    type: "better-sqlite3",
    database: ":memory:",
    dropSchema: true,
    synchronize: true,
    logging: false,
    entities,
  };
}

const dataSource = new DataSource(dbConfig);

export async function clearAll() {
  try {
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity);
      await repository.clear();
    }
  } catch (error) {
    throw new Error(`ERROR: Cleaning test db: ${Helper.assertError(error).toString()}`);
  }
}

export default dataSource;
