import Supervisor from "./src/Supervisor";
import { Git } from "./src/models/Git";
import Helper from "./src/Helper";
import {
  hpcConfig,
  maintainerConfig,
  containerConfig,
  folderEditable,
} from "./src/types";
import {
  config,
  containerConfigMap,
  hpcConfigMap,
  maintainerConfigMap,
  jupyterGlobusMap,
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

// index
app.get("/", (req, res) => {
  res.json({ message: "hello world" });
});

// statistic
app.get("/statistic", async (req, res) => {
  res.json({ runtime_in_seconds: await statistic.getRuntimeTotal() });
});

/**
 * /:
 *  get:
 *      description: Get the runtime for a specific job.
 *      responses:
 *          200:
 *              descrption: Returns the runtime for the specified job.
 *          401:
 *              description: Returns a list of errors rasied when validating the job access token.
 *          402:
 *              description: Returns a list of errors with the format of the req body.
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
 * /:
 *  get:
 *      description: Returns the current user's username.
 *      responses:
 *          200:
 *              description: Returns the current user's username.
 *          402:
 *              description: Returns a list of errors with the format of the req body if there are any, or "invalid token" if there is no user logged in.
 */
app.get("/user", (req, res) => {
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

  res.json({ username: res.locals.username });
});

/**
 * @openapi
 * /user/jupyter-globus:
 *  get:
 *      description: Returns the jupyter-globus endpoint, root path and container home path
 *      responses:
 *          200:
 *              description: Returns the jupyter-globus endpoint, root path and container home path.
 *          402:
 *              description: Returns a list of errors with the format of the req body along with "invalid input" if there are any, or "invalid token" if there is no user logged in.
 *          404:
 *              description: Returns "unknown host" if jupyter-globus cannot be found in local hosts.
 */
app.get("/user/jupyter-globus", (req, res) => {
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

  var jupyterGlobus = jupyterGlobusMap[res.locals.host];
  if (!jupyterGlobus) {
    res.status(404).json({ error: "unknown host" });
    return;
  }

  var username = res.locals.username.split("@")[0];
  if (!jupyterGlobus.direct_user_mapping) {
    try {
      const usename = await GlobusUtil.mapIGUIDEusername(username);
    } catch (err) {
      res
        .status(403)
        .json({ error: `Failed to map jupyter-globus: ${err.toString()}` });
      return;
    }
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
 *      description: Returns all of the jobs for the current user.
 *      responses:
 *          200:
 *              description: Returns all of the jobs for the current user.
 *          402:
 *              description: Returns a list of errors with the format of the req body along with "invalid input" if there are any, or "invalid token" if there is no user logged in.
 */
app.get("/user/job", async (req, res) => {
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
 *      description: Returns slurm usage for the current user
 *      responses:
 *          200:
 *              description: Returns slurm usage for the current user
 *          402:
 *              description: Returns a list of errors with the format of the req body along with "invalid input" if there are any, or "invalid token" if there is no user logged in.
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
 *      description: Returns current hpcConfig
 *      responses:
 *          200:
 *              description: Returns current hpcConfig
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
 *      description: Returns current maintainerConfig
 *      responses:
 *          200:
 *              description: Returns current maintainerConfig
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
 * /maintainer:
 *  get:
 *      description: Returns current containerConfig
 *      responses:
 *          200:
 *              description: Returns current containerConfig
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
  res.json({ container: parseContainer(containerConfigMap) });
});

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
      `download-folder-${folder.id}`
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

// job
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

app.put("/job/:jobId/pause", async function (req, res) {});

app.put("/job/:jobId/resume", async function (req, res) {});

app.put("/job/:jobId/cancel", async function (req, res) {});

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

app.get("/job/:jobId/result-folder-content", async function (req, res) {
  const body = req.body;
  const errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.json({ error: "invalid input", messages: errors });
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

app.get("/job/:jobId/logs", async function (req, res) {
  var body = req.body;
  var errors = requestErrors(validator.validate(body, schemas.user));

  if (errors.length > 0) {
    res.json({ error: "invalid input", messages: errors });
    res.status(402);
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
