import Supervisor from "./src/Supervisor";
import { Git } from "./src/models/Git";
import Helper from "./src/Helper";
import {
  hpcConfig,
  maintainerConfig,
  containerConfig,
  folderEditable,
  jupyterGlobusMapConfig,
  announcementsConfig
} from "./src/types";
import {
  config,
  containerConfigMap,
  hpcConfigMap,
  maintainerConfigMap,
  jupyterGlobusMap,
  // announcementMap
} from "./configs/config";
import GlobusUtil, { GlobusTaskListManager } from "./src/lib/GlobusUtil";
import express = require("express");
import { Job } from "./src/models/Job";
import JupyterHub from "./src/JupyterHub";
import DB from "./src/DB";
import Statistic from "./src/Statistic";
import * as path from "path";
import JobUtil, { ResultFolderContentManager } from "./src/lib/JobUtil";
import GitUtil from "./src/lib/GitUtil";
import SSHCredentialGuard from "./src/SSHCredentialGuard";
import { Folder } from "./src/models/Folder";
const swaggerUI = require("swagger-ui-express");
const swaggerDocument = require("../production/swagger.json");
const bodyParser = require("body-parser");
const Validator = require("jsonschema").Validator;
const fileUpload = require("express-fileupload");
const morgan = require("morgan");

const app = express();
app.use(bodyParser.json());
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: config.local_file_system.limit_in_mb * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: config.local_file_system.cache_path,
    safeFileNames: true,
    limitHandler: (req, res, next) => {
      res.json({ error: "file too large" });
      res.status(402);
    },
  })
);

const supervisor = new Supervisor();
const validator = new Validator();
const db = new DB();
const sshCredentialGuard = new SSHCredentialGuard();
const resultFolderContent = new ResultFolderContentManager();
const jupyterHub = new JupyterHub();
const statistic = new Statistic();
const globusTaskList = new GlobusTaskListManager();

app.use(async function (req, res, next) {
  if (req.body.jupyterhubApiToken) {
    try {
      res.locals.username = await jupyterHub.getUsername(
        req.body.jupyterhubApiToken
      );
      res.locals.host = await jupyterHub.getHost(req.body.jupyterhubApiToken);
    } catch {}
  }
  next();
});

var schemas = {
  user: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
    },
    required: ["jupyterhubApiToken"],
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
  updateAnnouncements: {
    type: "object",
    properties: {
      jupyterhubApiToken: { type: "string" },
      message: { type: "string" },
    },
    required: ["jupyterhubApiToken", "message"],
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
      jobId: { type: "string"},
      jupyterhubApiToken: { type: "string" },
      toEndpoint: { type: "string" },
      toPath: { type: "string" },
      fromPath: { type: "string" },
    },
    required: ["jupyterhubApiToken", "toEndpoint", "toPath"],
  },
};

function requestErrors(v) {
  if (v.valid) return [];
  var errors = [];
  for (var i in v.errors) errors.push(v.errors[i].message);
  return errors;
}

async function prepareDataForDB(data, properties) {
  const out = {};
  const connection = await db.connect();
  for (var i in properties) {
    const property = properties[i];
    if (data[property]) {
      if (
        property == "remoteExecutableFolder" ||
        property == "remoteDataFolder"
      ) {
        const folder = connection.getRepository(Folder).findOne(data[property]);
        if (!folder) throw new Error("could not find " + property);
        out[property] = folder;
      } else {
        out[property] = data[property];
      }
    }
  }
  return out;
}

async function initHelloWorldGit() {
  const connection = await db.connect();
  const helloWorldGit = await connection
    .getRepository(Git)
    .findOne("hello_world");
  if (helloWorldGit == undefined) {
    const git = {
      id: "hello_world",
      address: `https://github.com/cybergis/cybergis-compute-hello-world.git`,
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await connection.getRepository(Git).save(git);
  }
}

initHelloWorldGit();

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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token is not provided
 *
 */
app.get("/statistic/job/:jobId", async (req, res) => {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  try {
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOne({ id: req.params.jobId, userId: res.locals.username });
    res.json({ runtime_in_seconds: await statistic.getRuntimeByJobId(job.id) });
  } catch (e) {
    res.status(401).json({ error: "invalid access", messages: [e.toString()] });
    return;
  }
});

/**
 * @openapi
 * /user:
 *  get:
 *      description: Returns the current user's username (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns the current user's username
 *          402:
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns an error if the user's username is not in the allowlist
 */
app.get("/user", (req, res) => {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  if (!Helper.isAllowlisted(res.locals.host)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  res.json({ username: res.locals.username });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns an error if the current user does not map to a jupyter-globus user
 *          404:
 *              description: Returns an error if the user's username is not in the allowlist
 */
app.get("/user/jupyter-globus", async (req, res) => {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  if (!Helper.isAllowlisted(res.locals.host)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  var username_array = res.locals.username.split("@");
  var username = username_array.slice(0, username_array.length - 1).join("@");
  var jupyterGlobus = jupyterGlobusMap[res.locals.host]
  try {
    username = await GlobusUtil.mapUsername(
      username,
      jupyterGlobus.user_mapping
    );
  } catch (err) {
    res
      .status(403)
      .json({ error: `Failed to map jupyter-globus: ${err.toString()}` });
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
 *      description: Returns a list of all of the current user's jobs (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns all of the jobs for the current user in a list of dictionary objects representing each job
 *          402:
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns an error if the user's username is not in the allowlist
 */
app.get("/user/job", async (req, res) => {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  if (!Helper.isAllowlisted(res.locals.host)) {
    res.status(404).json({ error: "Cannot find jupyterhubHost in allowlist" });
    return;
  }

  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  const connection = await db.connect();
  const jobs = await connection.getRepository(Job).find({
    where: { userId: res.locals.username },
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 */
app.get("/user/slurm-usage", async (req, res) => {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  res.json(await JobUtil.getUserSlurmUsage(res.locals.username, true));
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
  var parseHPC = (dest: { [key: string]: hpcConfig }) => {
    var out = {};
    for (var i in dest) {
      var d: hpcConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
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
  var parseMaintainer = (dest: { [key: string]: maintainerConfig }) => {
    var out = {};
    for (var i in dest) {
      var d: maintainerConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
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
  var parseContainer = (dest: { [key: string]: containerConfig }) => {
    var out = {};
    for (var i in dest) {
      var d: containerConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
      if (!(i in ["dockerfile", "dockerhub"])) out[i] = d;
    }
    return out;
  };
  res.json({ container: parseContainer(containerConfigMap)});
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
  var parseHost = (dest: { [key: string]: jupyterGlobusMapConfig }) => {
    var out = {};
    for (var i in dest) {
      var d: jupyterGlobusMapConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
      out[i] = d.comment;
    }
    return out;
  };
  res.json({ whitelist: parseHost(jupyterGlobusMap)});
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
  var parseHost = (dest: { [key: string]: jupyterGlobusMapConfig }) => {
    var out = {};
    for (var i in dest) {
      var d: jupyterGlobusMapConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
      out[i] = d.comment;
    }
    return out;
  };
  res.json({ allowlist: parseHost(jupyterGlobusMap)});
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

  var fs = require('fs');
  fs.readFile('./configs/announcement.json', 'utf8', function(err, data){
    var parseHost = (dest: { [key: string]: announcementsConfig }) => {
      var out = {};
      for (var i in dest) {
        var d: announcementsConfig = JSON.parse(JSON.stringify(dest[i])); // hard copy
        out[i] = d;
      }
      return out;
    };
    res.json(parseHost(JSON.parse(data)));
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
  var parseGit = async (dest: Git[]) => {
    var out = {};
    for (var i in dest) {
      try {
        await GitUtil.refreshGit(dest[i]);
        out[dest[i].id] = await GitUtil.getExecutableManifest(dest[i]);
      } catch (e) {
        console.error(`cannot clone git: ${e.toString()}`);
      }
    }
    return out;
  };

  var connection = await db.connect();
  var gits = await connection
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 */
app.get("/folder", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .find({ userId: res.locals.username });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 */
app.get("/folder/:folderId", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .find({ userId: res.locals.username, id: req.params.folderId });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns "unknown folder with id" when the specified folder is not found
 */
app.delete("/folder/:folderId", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .findOne({ userId: res.locals.username, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }

  try {
    await connection.getRepository(Folder).softDelete(folderId);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(401).json({ error: "encountered error: " + err.toString() });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          404:
 *              description: Returns "unknown folder with id" when the specified folder is not found
 */
app.put("/folder/:folderId", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.updateFolder));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection
    .getRepository(Folder)
    .findOne({ userId: res.locals.username, id: folderId });
  if (!folder) {
    res.status(404).json({ error: "unknown folder with id " + folderId });
    return;
  }

  if (body.name) folder.name = body.name;
  if (body.isWritable) folder.isWritable = body.isWritable;
  try {
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
    res.status(401).json({ error: "encountered error: " + err.toString() });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns error when the folder ID cannot be found, when the hpc config for globus cannot be found, when the globus download fails, or when a download is already running for the folder
 */
app.post("/folder/:folderId/download/globus-init", async function (req, res) {
  const body = req.body;
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

  // get jobId
  const jobId = body.jobId;

  // get folder
  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection.getRepository(Folder).findOneOrFail(folderId);
  if (!folder) {
    res.status(403).json({ error: `cannot find folder with id ${folderId}` });
    return;
  }
  const existingTransferJob = await globusTaskList.get(folderId);
  if (existingTransferJob) {
    res.status(403).json({
      error: `a globus job is currently running on folder with id ${folderId}`,
    });
    return;
  }
  // get jupyter globus config
  const hpcConfig = hpcConfigMap[folder.hpc];
  if (!hpcConfig) {
    res.status(403).json({ error: `cannot find hpc ${folder.hpc}` });
    return;
  }
  // init transfer
  const fromPath = body.fromPath
    ? path.join(folder.globusPath, body.fromPath)
    : folder.globusPath;
  const from = { path: fromPath, endpoint: hpcConfig.globus.endpoint };
  const to = { path: body.toPath, endpoint: body.toEndpoint };
  console.log(from, to);
  try {
    const globusTaskId = await GlobusUtil.initTransfer(
      from,
      to,
      hpcConfig,
      `job-id-${jobId}-download-folder-${folder.id}`
    );
    await globusTaskList.put(folderId, globusTaskId);
    res.json({ globus_task_id: globusTaskId });
  } catch (err) {
    res
      .status(403)
      .json({ error: `failed to init globus with error: ${err.toString()}` });
    return;
  }
});

/**
 * @openapi
 * /folder/:folderId/download/globus-status:
 *  get:
 *      description: Gets the status of a globus download job currenty happening on the given folder ID (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns status of current globus download (if no download is occuring {} is returned)
 *          402:
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or 'invalid token' if a valid jupyter token authentication is not provided
 *          403:
 *              description: Returns error when the folder ID cannot be found or when the globus query fails
 */
app.get("/folder/:folderId/download/globus-status", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));
  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res.status(402).json({ error: "invalid token" });
    return;
  }

  // get folder
  const folderId = req.params.folderId;
  const connection = await db.connect();
  const folder = await connection.getRepository(Folder).findOneOrFail(folderId);
  if (!folder) {
    res.status(403).json({ error: `cannot find folder with id ${folderId}` });
    return;
  }
  // query status
  const globusTaskId = await globusTaskList.get(folderId);
  try {
    const status = await GlobusUtil.queryTransferStatus(
      globusTaskId,
      hpcConfigMap[folder.hpc]
    );
    if (["SUCCEEDED", "FAILED"].includes(status))
      await globusTaskList.remove(folderId);
    res.json({ status: status });
  } catch (err) {
    res
      .status(403)
      .json({ error: `failed to query globus with error: ${err.toString()}` });
    return;
  }
});

/**
 * @openapi
 * /job:
 *  post:
 *      description: Posts a job to run with the corresponding metatdata in the request (Authentication REQUIRED)
 *      responses:
 *          200:
 *              description: Returns when job is successfully posted
 *          401:
 *              description: Returns an error when the request passes an unrecognized maintainer or hpc or if SSH credentials are invalid
 *          402:
 *              description: Returns 'invalid input' and a list of errors with the format of the req body
 */
app.post("/job", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.createJob));
  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }

  const maintainerName = body.maintainer ?? "community_contribution";
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

  try {
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
      .json({ error: "invalid SSH credentials", messages: [e.toString()] });
    return;
  }

  const connection = await db.connect();
  const jobRepo = connection.getRepository(Job);

  const job: Job = new Job();
  job.id = Helper.generateId();
  job.userId = res.locals.username ? res.locals.username : null;
  job.maintainer = maintainerName;
  job.hpc = hpcName;
  job.param = {};
  job.slurm = {};
  job.env = {};
  if (!hpc.is_community_account)
    job.credentialId = await sshCredentialGuard.registerCredential(
      body.user,
      body.password
    );
  await jobRepo.save(job);

  res.json(Helper.job2object(job));
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body, 'invalid token' if a valid jupyter token authentication is not provided, or an error if the job does not exist
 *          403:
 *              description: Returns internal error when there is an exception while updating the job details
*/
app.put("/job/:jobId", async function (req, res) {
  const body = req.body;
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
      .findOneOrFail({ id: jobId, userId: res.locals.username });
    // update
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
        .json({ error: "internal error", messages: err.toString() });
      return;
    }
    // return updated job
    const job = await connection.getRepository(Job).findOne(jobId);
    res.json(Helper.job2object(job));
  } catch (e) {
    res.json({ error: e.toString() });
    res.status(402);
    return;
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body or a list of errors if the job does not successfully submit
*/
app.post("/job/:jobId/submit", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  var job = null;
  const jobId = req.params.jobId;

  try {
    const connection = await db.connect();
    job = await connection.getRepository(Job).findOneOrFail(
      { id: jobId, userId: res.locals.username },
      {
        relations: [
          "remoteExecutableFolder",
          "remoteDataFolder",
          "remoteResultFolder",
        ],
      }
    );
  } catch (e) {
    res.status(401).json({ error: "invalid access", messages: [e.toString()] });
    return;
  }

  if (job.queuedAt) {
    res
      .status(401)
      .json({ error: "job already submitted or in queue", messages: [] });
    return;
  }

  try {
    await JobUtil.validateJob(job);
    await supervisor.pushJobToQueue(job);
    // update status
    var connection = await db.connect();
    job.queuedAt = new Date();
    await connection
      .createQueryBuilder()
      .update(Job)
      .where("id = :id", { id: job.id })
      .set({ queuedAt: job.queuedAt })
      .execute();
  } catch (e) {
    res.status(402).json({ error: e.toString() });
    return;
  }

  res.json(Helper.job2object(job));
});

/**
 * @openapi
 * /job/:jobId/pause:
 *  put:
 *      description: Not yet implemented
*/
app.put("/job/:jobId/pause", async function (req, res) {});

/**
 * @openapi
 * /job/:jobId/resume:
 *  put:
 *      description: Not yet implemented
*/
app.put("/job/:jobId/resume", async function (req, res) {});

/**
 * @openapi
 * /job/:jobId/cancel:
 *  put:
 *      description: Not yet implemented
*/
app.put("/job/:jobId/cancel", async function (req, res) {});

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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body
*/
app.get("/job/:jobId/events", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  try {
    const jobId = req.params.jobId;
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOneOrFail(
        { id: jobId, userId: res.locals.username },
        { relations: ["events"] }
      );
    res.json(job.events);
  } catch (e) {
    res
      .status(401)
      .json({ error: "invalid access token", messages: [e.toString()] });
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
 *              description: Returns array of dirrectories in the given job's result folder
 *          401:
 *              description: Returns "submit without login is not allowed" if the user is not logged in or "invalid access" if the folder cannot be accessed
 *          402:
 *              description: Returns 'invalid input' and a list of errors with the format of the req body
*/
app.get("/job/:jobId/result-folder-content", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res
      .status(402)
      .json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  try {
    const jobId = req.params.jobId;
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOneOrFail({ id: jobId, userId: res.locals.username });
    const out = await resultFolderContent.get(job.id);
    res.json(out ? out : []);
  } catch (e) {
    res.status(401).json({ error: "invalid access", messages: [e.toString()] });
    return;
  }
});

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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body
*/
app.get("/job/:jobId/logs", async function (req, res) {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res
      .status(402)
      .json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  try {
    const jobId = req.params.jobId;
    const connection = await db.connect();
    const job = await connection
      .getRepository(Job)
      .findOneOrFail(
        { id: jobId, userId: res.locals.username },
        { relations: ["logs"] }
      );
    res.json(job.logs);
  } catch (e) {
    res.status(401).json({ error: "invalid access", messages: [e.toString()] });
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
 *              description: Returns 'invalid input' and a list of errors with the format of the req body
*/
app.get("/job/:jobId", async function (req, res) {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.status(402).json({ error: "invalid input", messages: errors });
    return;
  }
  if (!res.locals.username) {
    res
      .status(401)
      .json({ error: "submit without login is not allowed", messages: [] });
    return;
  }

  try {
    const jobId = req.params.jobId;
    const connection = await db.connect();
    const job = await connection.getRepository(Job).findOneOrFail(
      { id: jobId, userId: res.locals.username },
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
    res.json({ error: "invalid access", messages: [e.toString()] });
    res.status(401);
    return;
  }
});

app.listen(config.server_port, config.server_ip, () =>
  console.log(
    "supervisor server is up, listening to port: " + config.server_port
  )
);
