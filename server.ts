import express = require("express");
// import { Console } from "console";
const swaggerDocument: Record<string, unknown> = require("../production/swagger.json");  // eslint-disable-line
// import bodyParser = require("body-parser");
import { Request, NextFunction, Response } from "express";
import fileUpload = require("express-fileupload");
import jsonschema = require("jsonschema");
import morgan = require("morgan");
import swaggerUI = require("swagger-ui-express");
import fs = require("fs");
import * as path from "path";
import {
  config,
  containerConfigMap,
  hpcConfigMap,
  maintainerConfigMap,
  jupyterGlobusMap
} from "./configs/config";
import DB from "./src/DB";
import JupyterHub from "./src/JupyterHub";
import GitUtil from "./src/lib/GitUtil";
import GlobusUtil, { GlobusTaskListManager } from "./src/lib/GlobusUtil";
import * as Helper from "./src/lib/Helper";
import JobUtil, { ResultFolderContentManager } from "./src/lib/JobUtil";
import { Folder } from "./src/models/Folder";
import { Git } from "./src/models/Git";
import { Job } from "./src/models/Job";
import { SSHCredentialGuard } from "./src/SSHCredentialGuard";
import Statistic from "./src/Statistic";
import Supervisor from "./src/Supervisor";
import type {
  hpcConfig,
  maintainerConfig,
  containerConfig,
  // folderEditable,
  jupyterGlobusMapConfig,
  announcementsConfig,
  authReqBody,
  updateFolderBody,
  initGlobusDownloadBody,
  createJobBody,
  updateJobBody,
} from "./src/types";

// create the express app
const app = express();

// handle parsing arguments
// app.use(bodyParser.json());  // possibly unneeded now with newer versions of express
app.use(express.json());
app.use(morgan("combined"));
// app.use(bodyParser.urlencoded({ extended: true }));

// uploading files
app.use(
  fileUpload({
    limits: { fileSize: config.local_file_system.limit_in_mb * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: config.local_file_system.cache_path,
    safeFileNames: true,
    limitHandler: (req, res, _next) => {
      res.json({ error: "file too large" });
      res.status(402);
    },
  })
);

// global object instantiation
const supervisor = new Supervisor();
const validator = new jsonschema.Validator();
const db = new DB();
const sshCredentialGuard = new SSHCredentialGuard();
const resultFolderContent = new ResultFolderContentManager();
const jupyterHub = new JupyterHub();
const statistic = new Statistic();
const globusTaskList = new GlobusTaskListManager();

// object for vadidating API calls
const schemas = {
  user: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  cancel: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      jobId: { type: "string" },
    },
    required: ["jupyterhubApiToken", "jobId"],
  },
  updateFolder: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      name: { type: "string" },
      isWritable: { type: "boolean" },
    },
    required: ["jupyterhubApiToken"],
  },
  updateJob: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      param: { type: "object" },
      env: { type: "object" },
      slurm: { type: "object" },
      localExecutableFolder: { type: "object" },
      localDataFolder: { type: "object" },
      remoteDataFolder: { type: "string" },
      remoteExecutableFolder: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  createJob: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      maintainer: { type: "string" },
      hpc: { type: "string" },
      user: { type: "string" },
      password: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
  },
  initGlobusDownload: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      jupyterhubApiToken: { type: "string" },
      toEndpoint: { type: "string" },
      toPath: { type: "string" },
      fromPath: { type: "string" },
    },
    required: ["jupyterhubApiToken", "toEndpoint", "toPath"],
  },
};

// handler for route errors
function requestErrors(v: jsonschema.ValidatorResult): string[] {
  if (v.valid) return [];

  const errors: string[] = [];
  for (const error of v.errors) errors.push(error.message);

  return errors;
}

// function to take data and get it into dictionary format for DB interfacing
async function prepareDataForDB(
  data: updateFolderBody, 
  properties: string[]
): Promise<Record<string, string>> {
  const out = {};
  const connection = await db.connect();

  for (const property of properties) {
    if (data[property]) {
      if (
        property === "remoteExecutableFolder" ||
        property === "remoteDataFolder"
      ) {
        const folder: Folder | undefined = await (connection.
          getRepository(Folder).
          findOne(data[property] as string)
        );

        if (!folder) throw new Error("could not find " + property);

        out[property] = folder;
      } else {
        out[property] = data[property] as string;
      }
    }
  }

  return out;
}

// initializes a hello world repository in the DB
async function initHelloWorldGit() {
  const connection = await db.connect();
  const helloWorldGit = await connection
    .getRepository(Git)
    .findOne("hello_world");

  if (helloWorldGit === undefined) {
    const git = {
      id: "hello_world",
      address: "https://github.com/cybergis/cybergis-compute-hello-world.git",
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await connection.getRepository(Git).save(git);
  }
}

initHelloWorldGit();  // eslint-disable-line

const authMiddleWare = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const body = req.body as authReqBody;
  
  // if there is an api token in the body
  if (body.jupyterhubApiToken) {
    try {
      // try to extract username/host and store into local variables
      res.locals.username = await jupyterHub.getUsername(
        body.jupyterhubApiToken
      );
      res.locals.host = jupyterHub.getHost(body.jupyterhubApiToken);
    } catch {}

    // continue onto the actual route
    next();
  // if there isn't, just give a 402 error
  } else {
    res.status(402).json(
      { error: "Malformed input. No jupyterhub api token passed with request."}
    );
  }
};

// create documentation routes
app.use("/ts-docs", express.static("production/tsdoc"));
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

/**
 * @openapi
 * /:
 *  get:
 *      description: Get "hello world" from the route directory (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              descrption: Successfuly returns "hello world"
 *
 */
app.get("/", (req, res) => {
  res.json({ message: "hello world" });
});

/**
 * @openapi
 * /statistic:
 *  get:
 *      description: Get the runtime of null across available HPC clusters (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              descrption: Returns JSON containing runtime in seconds total and per cluster (null here becauise no job referenced)
 *
 */
app.get("/statistic", async (req, res) => {
  res.json({ runtime_in_seconds: await statistic.getRuntimeTotal() });
});

/**
 * @openapi
 * /statistic/job/:jobId:
 *  get:
 *      description: Get the runtime for a specific job across available HPC clusters (Authentication REQUIRED)
 *      responses:
 *          200:
 *              descrption: Returns JSON containing runtime in seconds total and per cluster
 *          401:
 *              description: Returns a list of errors rasied when validating the job access token.
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token is not provided
 *
 */
app.get("/statistic/job/:jobId", authMiddleWare, async (req, res) => {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  try {
    // query the job matching the params
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOne({ id: req.params.jobId, userId: res.locals.username as string });

    if (job === undefined) {
      throw new Error("job not found.");
    }

    res.json({ runtime_in_seconds: await statistic.getRuntimeByJobId(job.id) });
  } catch (e) {
    res.status(401).json(
      { error: "invalid access", messages: [Helper.assertError(e).toString()] }
    );
  }
});

/**
 * @openapi
 * /user:
 *  get:
 *      description: Returns the current user"s username (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns the current user"s username
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns an error if the user"s username is not in the allowlist
 */
app.get("/user", authMiddleWare, (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  res.json({ username: res.locals.username as string });
});

/**
 * @openapi
 * /user/jupyter-globus:
 *  get:
 *      description: Returns jupyter-globus information incuding the endpoint, root path, and container home path (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns the jupyter-globus endpoint, root path and container home path as a single dictionary
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns an error if the current user does not map to a jupyter-globus user
 *          404:
 *              description: Returns an error if the user"s username is not in the allowlist
 */
app.get("/user/jupyter-globus", authMiddleWare, async (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // extract username minus the last segment after an @
  const username_array: string[] = (res.locals.username as string).split("@");
  let username = username_array.slice(0, username_array.length - 1).join("@");
  const jupyterGlobus = jupyterGlobusMap[res.locals.host as string];

  try {
    // get a processed username (mapping changes depending on the host)
    username = await GlobusUtil.mapUsername(
      username,
      jupyterGlobus.user_mapping ?? null
    );
  } catch (err) {
    res
      .status(403)
      .json({
        error: `Failed to map jupyter-globus: ${
          Helper.assertError(err).toString()
        }`
      });
    return;
  }

  res.json({
    endpoint: jupyterGlobus.endpoint,
    root_path: path.join(jupyterGlobus.root_path, username),
    container_home_path: jupyterGlobus.container_home_path,
  });
});

/**
 * @openapi
 * /user/job:
 *  get:
 *      description: Returns a list of all of the current user"s jobs (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns all of the jobs for the current user in a list of dictionary objects representing each job
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns an error if the user"s username is not in the allowlist
 */
app.get("/user/job", authMiddleWare, async (req, res) => {
  if (!Helper.isAllowlisted(res.locals.host as string)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // get all jobs associated with user
  const connection = await db.connect();
  const jobs = await connection.getRepository(Job).find({
    where: { userId: res.locals.username as string },
    relations: [
      "remoteDataFolder",
      "remoteResultFolder",
      "remoteExecutableFolder",
    ],
  });

  res.json({ job: Helper.job2object(jobs) });
});

/**
 * @openapi
 * /user/slurm-usage:
 *  get:
 *      description: Returns dictionary object of slurm usage for the current user (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns dictionary object of slurm usage for the current user
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 */
app.get("/user/slurm-usage", authMiddleWare, async (req, res) => {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // get all jobs associated with user, then aggregate, then return that
  res.json(
    await JobUtil.getUserSlurmUsage(res.locals.username as string, true)
  );
});

/**
 * @openapi
 * /hpc:
 *  get:
 *      description: Returns current hpc configurations for existing linked hpc clusters as a dictionary (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns current hpc configurations for existing linked hpc clusters as a dictionaruy
 */
app.get("/hpc", function (req, res) {
  const parseHPC = (dest: Record<string, hpcConfig>) => {
    // create truncated version of all hpc configs
    const out = {};
    for (const i in dest) {
      const d: Partial<hpcConfig> = JSON.parse(
        JSON.stringify(dest[i])
      ) as hpcConfig; // hard copy

      delete d.init_sbatch_script;
      delete d.init_sbatch_options;
      delete d.community_login;
      delete d.root_path;
      out[i] = d;
    }
    return out;
  };

  res.json({ hpc: parseHPC(hpcConfigMap) });
});

/**
 * @openapi
 * /maintainer:
 *  get:
 *      description: Returns current maintainer configurations as a dictionary object (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns current maintainer configurations as a dictionary object
 */
app.get("/maintainer", function (req, res) {
  const parseMaintainer = (dest: Record<string, maintainerConfig>) => {
    const out = {};
    for (const i in dest) {
      const d: maintainerConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as maintainerConfig; // hard copy

      out[i] = d;
    }
    return out;
  };

  res.json({ maintainer: parseMaintainer(maintainerConfigMap) });
});

/**
 * @openapi
 * /container:
 *  get:
 *      description: Returns current container configurations as a dictionary object (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns current container configurations as a dictionary object
 */
app.get("/container", function (req, res) {
  const parseContainer = (dest: Record<string, containerConfig>) => {
    const out = {};
    for (const i in dest) {
      const d: containerConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as containerConfig; // hard copy

      if (!(i in ["dockerfile", "dockerhub"])) out[i] = d;  // exclude dockerfiles/dockerhub configs
    }
    return out;
  };

  res.json({ container: parseContainer(containerConfigMap) });
});

/**
 * @openapi
 * /whitelist:
 *  get:
 *      description: (Use /allowlist instead. /whitelist is being phased out.) Returns current allowlist (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns current allowlist
 */
app.get("/whitelist", function (req, res) {
  const parseHost = (dest: Record<string, jupyterGlobusMapConfig>) => {
    const out = {};
    for (const i in dest) {
      const d = JSON.parse(JSON.stringify(dest[i])) as jupyterGlobusMapConfig; // hard copy
      out[i] = d.comment;
    }
    return out;
  };

  res.json({ whitelist: parseHost(jupyterGlobusMap) });
});

/**
 * @openapi
 * /allowlist:
 *  get:
 *      description: Returns current allowlist (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns current allowlist
 */
app.get("/allowlist", function (req, res) {
  const parseHost = (dest: Record<string, jupyterGlobusMapConfig>) => {
    const out = {};
    for (const i in dest) {
      const d: jupyterGlobusMapConfig = JSON.parse(
        JSON.stringify(dest[i])
      ) as jupyterGlobusMapConfig; // hard copy

      out[i] = d.comment;
    }
    return out;
  };

  res.json({ allowlist: parseHost(jupyterGlobusMap) });
});

/**
 * @openapi
 * /announcement:
 *  get:
 *      description: Returns list of current announcements (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns array of current announcements
 */
app.get("/announcement", function (req, res) {
  // read announcements from the announcements.json file
  fs.readFile("./configs/announcement.json", "utf8", function (err, data) {
    const parseHost = (dest: Record<string, announcementsConfig>) => {
      const out = {};
      for (const i in dest) {
        const d: announcementsConfig = JSON.parse(
          JSON.stringify(dest[i])
        ) as announcementsConfig; // hard copy

        out[i] = d;
      }
      return out;
    };

    res.json(
      parseHost(JSON.parse(data) as Record<string, announcementsConfig>)
    );
  });
});

/**
 * @openapi
 * /git:
 *  get:
 *      description: Returns collection of acceptable git jobs (Authentication NOT REQUIRED)
 *      responses:
 *          200:
 *              description: Returns JSON dictionary of git jobs including specs for each job
 */
app.get("/git", async function (req, res) {
  const parseGit = async (dest: Git[]) => {
    const out = {};
    for (const d of dest) {
      try {
        // refresh git (updating the database), then get the manifest.json from the repo and append it
        // await GitUtil.refreshGit(d);
        // out[d.id] = await GitUtil.getExecutableManifest(d);

        await GitUtil.refreshGitManifest(d);
        out[d.id] = await GitUtil.getExecutableManifestSpecialized(d);
      } catch (e) {  // pulling/cloning went wrong
        console.error(`cannot clone git: ${Helper.assertError(e).toString()}`);
      }
    }
    return out;
  };

  const connection = await db.connect();
  const gits = await connection
    .getRepository(Git)
    .find({ order: { id: "DESC" } });
  res.json({ git: await parseGit(gits) });
});

/**
 * @openapi
 * /folder:
 *  get:
 *      description: Returns list of folders stored as dictionary objects (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns list of folders as dictionary objects with metadata
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 */
app.get("/folder", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // get all folders associated with the user from the database
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .find({ userId: res.locals.username as string });
  res.json({ folder: folder });
});

/**
 * @openapi
 * /folder/:folderId:
 *  get:
 *      description: Returns a specific folder stored as a dictionary object (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns a folder as a dictionary object with metadata
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 */
app.get("/folder/:folderId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // get all folders associated with the user and with the given folder Id from the database
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .find({ userId: res.locals.username as string, id: req.params.folderId });
  res.json(folder);
});

/**
 * @openapi
 * /folder/:folderId:
 *  delete:
 *      description: Deletes an ID specified folder (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Deletes the folder specified by the ID
 *          401:
 *              description: Returns "encountered error" when the folder deletion throws an exception
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns "unknown folder with id" when the specified folder is not found
 */
app.delete("/folder/:folderId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // try to find the folder with the given id/associated user; if not found, give a 404
  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .findOne({ userId: res.locals.username as string, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }

  try {
    await connection.getRepository(Folder).softDelete(folderId);  // not actually deleted, just marked as such
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(401).json(
      { error: "encountered error: " + Helper.assertError(err).toString() }
    );

    return;
  }
});

/**
 * @openapi
 * /folder/:folderId:
 *  put:
 *      description: Updates a folder with the given ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Updates the folder specified by the ID and returns folder
 *          401:
 *              description: Returns "encountered error" when updating the folder throws an exception
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns "unknown folder with id" when the specified folder is not found
 */
app.put("/folder/:folderId", authMiddleWare, async function (req, res) {
  const body = req.body as updateFolderBody;
  const errors = requestErrors(validator.validate(body, schemas.updateFolder));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // try to find the folder specified in the body, if not found, give a 404
  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .findOne({ userId: res.locals.username as string, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }

  // body parameters to pass as folder properties
  if (body.name) folder.name = body.name;
  if (body.isWritable) folder.isWritable = body.isWritable;

  try {
    // update the folder entry and return it
    await connection
      .createQueryBuilder()
      .update(Folder)
      .where("id = :id", { id: folderId })
      .set(await prepareDataForDB(body, ["name", "isWritable"]))
      .execute();

    const updatedFolder = await connection
      .getRepository(Folder)
      .findOne(folderId);

    res.status(200).json(updatedFolder);
  } catch (err) {
    res.status(401).json(
      { error: "encountered error: " + Helper.assertError(err).toString() }
    );

    return;
  }
});

/**
 * @openapi
 * /folder/:folderId/download/globus-init:
 *  post:
 *      description: Posts a request to initiate a globus download of the specified folder (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Globus download of the specific folder is successful
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns error when the folder ID cannot be found, when the hpc config for globus cannot be found, when the globus download fails, or when a download is already running for the folder
 */
app.post(
  "/folder/:folderId/download/globus-init", 
  authMiddleWare, 
  async function (req, res) {
    const body = req.body as initGlobusDownloadBody;
    const errors = requestErrors(
      validator.validate(body, schemas.initGlobusDownload)
    );

    if (errors.length > 0) {
      res.status(402).json({ error: "invalid input", messages: errors });
      return;
    }
    if (!res.locals.username) {
      res.status(402).json({ error: "invalid token" });
      return;
    }

    // get jobId from body
    const jobId = body.jobId;

    // get folder; if not found, error out
    const folderId = req.params.folderId;
    const connection = await db.connect();
    const folder = await (connection
      .getRepository(Folder)
      .findOneOrFail(folderId)
    );
    
    if (!folder) {
      res.status(403).json({ error: `cannot find folder with id ${folderId}` });
      return;
    }

    // check if there is an existing globus job from the redis DB -- if so, error out
    const existingTransferJob: string | null = (
      await globusTaskList.get(folderId)
    );

    if (existingTransferJob) {
      res.status(403).json({
        error: `a globus job is currently running on folder with id ${folderId}`,  // eslint-disable-line
      });
      return;
    }

    // get jupyter globus config
    const hpcConfig = hpcConfigMap[folder.hpc];
    if (!hpcConfig) {
      res.status(403).json({ error: `cannot find hpc ${folder.hpc}` });
      return;
    }

    Helper.nullGuard(hpcConfig.globus);

    // init transfer
    const fromPath = body.fromPath
      ? path.join(folder.globusPath, body.fromPath)
      : folder.globusPath;
    const from = { path: fromPath, endpoint: hpcConfig.globus.endpoint };
    const to = { path: body.toPath, endpoint: body.toEndpoint };
    // console.log(from, to);

    try {
      Helper.nullGuard(hpcConfig.globus);
    
      // start the transfer
      const globusTaskId = await GlobusUtil.initTransfer(
        from,
        to,
        hpcConfig,
        `job-id-${jobId}-download-folder-${folder.id}`
      );

      // record the task as ongoing for the given folder
      await globusTaskList.put(folderId, globusTaskId);
      res.json({ globus_task_id: globusTaskId });
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: `failed to init globus with error: ${Helper.assertError(err).toString()}`
        });
      return;
    }
  }
);

/**
 * @openapi
 * /folder/:folderId/download/globus-status:
 *  get:
 *      description: Gets the status of a globus download job currenty happening on the given folder ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns status of current globus download (if no download is occuring {} is returned)
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or "invalid token" if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns error when the folder ID cannot be found or when the globus query fails
 */
app.get(
  "/folder/:folderId/download/globus-status", 
  authMiddleWare, 
  async function (req, res) {
    if (!res.locals.username) {
      res.status(402).json({ error: "invalid token" });
      return;
    }

    // get folder -- if doesn't exist, error out
    const folderId = req.params.folderId;
    const connection = await db.connect();
    const folder = await (connection
      .getRepository(Folder)
      .findOneOrFail(folderId)
    );

    if (!folder) {
      res.status(403).json({ error: `cannot find folder with id ${folderId}` });
      return;
    }

    // query status
    const globusTaskId = await globusTaskList.get(folderId);
    try {
      if (!globusTaskId) {
        throw new Error("No task id found.");
      }

      const status = await GlobusUtil.queryTransferStatus(
        globusTaskId,
        hpcConfigMap[folder.hpc]
      );

      // remove the folder from the ongoing globus task list if the globus transfer finished
      if (["SUCCEEDED", "FAILED"].includes(status))
        await globusTaskList.remove(folderId);  

      res.json({ status: status });
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: `failed to query globus with error: ${Helper.assertError(err).toString()}`
        });
      return;
    }
  }
);

/**
 * @openapi
 * /job:
 *  post:
 *      description: Posts a job to run with the corresponding metadata in the request (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns when job is successfully posted
 *          401:
 *              description: Returns an error when the request passes an unrecognized maintainer or hpc or if SSH credentials are invalid
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
app.post("/job", authMiddleWare, async function (req, res) {
  const body = req.body as createJobBody;
  const errors = requestErrors(validator.validate(body, schemas.createJob));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  // try to extract maintainer and hpc associated with the job
  const maintainerName: string = body.maintainer ?? "community_contribution";  // default to community contribution job maintainer
  const maintainer = maintainerConfigMap[maintainerName];
  if (maintainer === undefined) {
    res.status(401).json({ error: "unrecognized maintainer", message: null });
    return;
  }

  const hpcName = body.hpc ? body.hpc : maintainer.default_hpc;
  const hpc = hpcConfigMap[hpcName];
  if (hpc === undefined) {
    res.status(401).json({ error: "unrecognized hpc", message: null });
    return;
  }

  // check if the user can use the HPC
  const allowedOnHPC = Helper.canAccessHPC(
    res.locals.username as string, 
    hpcName
  );
  // console.log(allowedOnHPC);
  
  if (!allowedOnHPC) {
    res.status(401).json({ error: "Not authorized for HPC", message: null });
    return;
  }

  try {
    // need to validate if hpc is not a community account
    if (!hpc.is_community_account) {
      await sshCredentialGuard.validatePrivateAccount(
        hpcName,
        body.user,
        body.password
      );
    }
  } catch (e) {
    res
      .status(401)
      .json({ 
        error: "invalid SSH credentials", 
        messages: [Helper.assertError(e).toString()] 
      });
    return;
  }

  // start job db connection & create the job object to upload
  const connection = await db.connect();
  const jobRepo = connection.getRepository(Job);

  const job: Job = new Job();
  job.id = Helper.generateId();
  job.userId = (res.locals.username as string 
    ? res.locals.username as string 
    : undefined
  );
  job.maintainer = maintainerName;
  job.hpc = hpcName;
  job.param = {};
  job.slurm = {};
  job.env = {};

  // store credentials if not community account/need verification
  if (!hpc.is_community_account)
    job.credentialId = await sshCredentialGuard.registerCredential(
      body.user,
      body.password
    );

  await jobRepo.save(job);

  res.json(Helper.job2object(job));  // return the job converted to a dictionary
});

/**
 * @openapi
 * /job/:jobId:
 *  put:
 *      description: Updates a job with the given job ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns updated job when it is successfully updated
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body, "invalid token" if a valid jupyter token authentication is not provided, or an error if the job does not exist
 *          403:
 *              description: Returns internal error when there is an exception while updating the job details
 */
app.put("/job/:jobId", authMiddleWare, async function (req, res) {
  const body = req.body as updateJobBody;
  const errors = requestErrors(validator.validate(body, schemas.updateJob));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  try {
    // test if job exists
    const jobId = req.params.jobId;
    const connection = await db.connect();
    await connection
      .getRepository(Job)
      .findOneOrFail({ id: jobId, userId: res.locals.username as string });

    // update the job with the given id
    try {
      await connection
        .createQueryBuilder()
        .update(Job)
        .where("id = :id", { id: jobId })
        .set(
          await prepareDataForDB(body, [
            "param",
            "env",
            "slurm",
            "localExecutableFolder",
            "localDataFolder",
            "remoteDataFolder",
            "remoteExecutableFolder",
          ])
        )
        .execute();
    } catch (err) {
      res
        .status(403)
        .json({ 
          error: "internal error", 
          messages: Helper.assertError(err).toString() 
        });
      return;
    }

    // return updated job as a dictionary
    const job = await connection.getRepository(Job).findOne(jobId);

    if (job === undefined) {
      throw new Error("Updated job not found in the database.");
    }

    res.json(Helper.job2object(job));
  } catch (e) {
    res.json({ error: Helper.assertError(e).toString() });
    res.status(402);
  }
});

/**
 * @openapi
 * /job/:jobId/submit:
 *  post:
 *      description: Submits a job with the given job ID to the HPC (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns when job is successfully submitted
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in, "invalid access" if job folders are not accessible, or "job already submitted or in queue" if the job is already suibmitted
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body or a list of errors if the job does not successfully submit
 */
app.post("/job/:jobId/submit", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  let job: Job | null = null;
  const jobId = req.params.jobId;

  // try to find the specified job
  try {
    const connection = await db.connect();
    job = await connection.getRepository(Job).findOneOrFail(
      { id: jobId, userId: res.locals.username as string },
      {
        relations: [
          "remoteExecutableFolder",
          "remoteDataFolder",
          "remoteResultFolder",
        ],
      }
    );
  } catch (e) {
    res.status(401).json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    return;
  }

  // if already queued, do nothing
  if (job.queuedAt) {
    res
      .status(401)
      .json({ error: "job already submitted or in queue", messages: [] });
    return;
  }

  try {
    // validate job and push it to the job queue
    JobUtil.validateJob(job);
    await supervisor.pushJobToQueue(job);

    // update status of the job
    const connection = await db.connect();
    job.queuedAt = new Date();
    await connection
      .createQueryBuilder()
      .update(Job)
      .where("id = :id", { id: job.id })
      .set({ queuedAt: job.queuedAt })
      .execute();
  } catch (e) {
    res.status(402).json({ error: Helper.assertError(e).toString() });
    return;
  }

  res.json(Helper.job2object(job));
});

/**
 * @openapi
 * /clean:
 *  put:
 *      description: Not yet implemented
 */
app.put("/clean", async function (_req, _res) { });  // eslint-disable-line

/**
 * @openapi
 * /job/:jobId/pause:
 *  put:
 *      description: Not yet implemented
 */
app.put("/job/:jobId/pause", async function (_req, _res) { }); // eslint-disable-line

/**
 * @openapi
 * /job/:jobId/resume:
 *  put:
 *      description: Not yet implemented
 */
app.put("/job/:jobId/resume", async function (_req, _res) { }); // eslint-disable-line

/**
 * @openapi
 * /job/:jobId/cancel:
 *  put:
 *      description: Cancels a job that is currently in the queue
 *      responses:
 *          200:
 *              description: Job was found successfully added to the queue to be canceled
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access token" if the events cannot be accessed
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body - jobId may be invalid or job may not be in queue
 */
app.put("/job/:jobId/cancel", function (req, res) {
  // console.log("made it to cancel");
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "cancel without login is not allowed", messages: [] });
    return;
  }

  try {
    // try to cancel the job on the supervisor job manager
    const jobId = req.params.jobId;
    const job = supervisor.cancelJob(jobId);

    // check if the job was successfully cancelled (per the return value from cancelJob)
    if (job === null) {
      res.status(402).json({ error: "job is not in queue or running jobs" });
      return;
    }

    res.status(200).json({ 
      messages: ["job successfully added to cancel queue"] 
    });
  } catch (e) {
    res.status(402).json({ 
      error: "invalid jobId", 
      messages: [Helper.assertError(e).toString()] 
    });
  }
});

/**
 * @openapi
 * /job/:jobId/events:
 *  get:
 *      description: Gets an array of the job events for a given job ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns array of dictionary objects containing details of each event in the process of ssubmitting and fufilling a a job
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access token" if the events cannot be accessed
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
app.get("/job/:jobId/events", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "listing events without login is not allowed", messages: [] });
    return;
  }

  try {
    // get events from the job repo (updated in the supervisor/with individual maintainers)
    const jobId = req.params.jobId;
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOneOrFail(
        { id: jobId, userId: res.locals.username as string },
        { relations: ["events"] }
      );
    res.json(job.events);
  } catch (e) {
    res
      .status(401)
      .json({ 
        error: "invalid access token", 
        messages: [Helper.assertError(e).toString()] 
      });
    return;
  }
});

/**
 * @openapi
 * /job/:jobId/result-folder-content:
 *  get:
 *      description: Gets an array of the directories in the result folder for a given job ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns array of dirrectories in the given job"s result folder
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the folder cannot be accessed
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
app.get(
  "/job/:jobId/result-folder-content", 
  authMiddleWare, 
  async function (req, res) {
    if (!res.locals.username) {
      res
        .status(401)
        .json({ error: "getting results without login is not allowed", messages: [] });
      return;
    }

    try {
    // query the result folder content from the job repo
      const jobId = req.params.jobId;
      const connection = await db.connect();
      const job = await connection
        .getRepository(Job)
        .findOneOrFail({ id: jobId, userId: res.locals.username as string });
    
      const out = await resultFolderContent.get(job.id);
      res.json(out ? out : []);
    } catch (e) {
      res.status(401).json({ 
        error: "invalid access", 
        messages: [Helper.assertError(e).toString()] 
      });
      return;
    }
  }
);

/**
 * @openapi
 * /job/:jobId/logs:
 *  get:
 *      description: Gets an array of dictionary objects that represent logs for the given job ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns array of dictionary objects that represent logs for the given job ID
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the logs cannot be accessed
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
app.get("/job/:jobId/logs", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res.status(401).json({ 
      error: "getting logs without login is not allowed", 
      messages: [] 
    });
    return;
  }

  try {
    // try to get the logs from teh jobs database (continuously updated in the maintainer)
    const jobId = req.params.jobId;
    const connection = await db.connect();

    const job = await connection
      .getRepository(Job)
      .findOneOrFail(
        { id: jobId, userId: res.locals.username as string },
        { relations: ["logs"] }
      );
    res.json(job.logs);
  } catch (e) {
    res.status(401).json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    return;
  }
});

/**
 * @openapi
 * /job/:jobId:
 *  get:
 *      description: Gets a dictionary object representing the given job ID that includes information on the job as well as events, logs, and folder information (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns a dictionary object representing the given job ID
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the job and job information cannot be accessed
 *          402:
 *              description: Returns "invalid input" and a list of errors with the format of the req body
 */
app.get("/job/:jobId", authMiddleWare, async function (req, res) {
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "getting job info without login is not allowed", messages: [] });
    return;
  }

  try {
    // query job database for all requested things, return it as a dictionary json
    const jobId = req.params.jobId;
    const connection = await db.connect();
    
    const job = await connection.getRepository(Job).findOneOrFail(
      { id: jobId, userId: res.locals.username as string },
      {
        relations: [
          "remoteExecutableFolder",
          "remoteDataFolder",
          "remoteResultFolder",
          "events",
          "logs",
        ],
      }
    );
    res.json(Helper.job2object(job));
  } catch (e) {
    res.json({ 
      error: "invalid access", 
      messages: [Helper.assertError(e).toString()] 
    });
    res.status(401);
    return;
  }
});

app.listen(config.server_port, config.server_ip, () =>
  console.log(
    "supervisor server is up, listening to port: " + config.server_port
  )
);
