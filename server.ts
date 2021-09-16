import Guard from './src/Guard'
import Supervisor from './src/Supervisor'
import { Git } from './src/models/Git'
import { FileSystem, GitFolder, GlobusFolder, LocalFolder } from './src/FileSystem'
import Helper from './src/Helper'
import { hpcConfig, maintainerConfig, containerConfig } from './src/types'
import { config, containerConfigMap, hpcConfigMap, maintainerConfigMap } from './configs/config'
import GlobusUtil, { JobGlobusTaskListManager } from './src/lib/GlobusUtil'
import express = require('express')
import { Job } from './src/models/Job'
import JupyterHub from './src/JupyterHub'
import DB from './src/DB'
const bodyParser = require('body-parser')
const Validator = require('jsonschema').Validator;
const fileUpload = require('express-fileupload')
const morgan = require('morgan')

const app = express()
app.use(bodyParser.json())
app.use(morgan('combined'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(fileUpload({
    limits: { fileSize: config.local_file_system.limit_in_mb * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: config.local_file_system.cache_path,
    safeFileNames: true,
    limitHandler: (req, res, next) => {
        res.json({ error: "file too large" })
        res.status(402)
    }
}))

const guard = new Guard()
const supervisor = new Supervisor()
const validator = new Validator()
const db = new DB()
const globusTaskList = new JobGlobusTaskListManager()
const jupyterHub = new JupyterHub()

app.use(async function (req, res, next) {
    if (req.body.jupyterhubApiToken) {
        try {
            res.locals.username = await jupyterHub.getUsername(req.body.jupyterhubApiToken)
            console.log(res.locals.username)
        } catch {}
    }
    next()
})

FileSystem.createClearLocalCacheProcess()

var schemas = {
    user: {
        type: 'object',
        properties: {
            jupyterhubApiToken: { type: 'string' },
        },
        required: ['jupyterhubApiToken']
    },

    updateJob: {
        type: 'object',
        properties: {
            accessToken: { type: 'string' },
            jupyterhubApiToken: { type: 'string' },
            param: { type: 'object' },
            env: { type: 'object' },
            slurm: { type: 'object' },
            executableFolder: { type: 'string' },
            dataFolder: { type: 'string' },
            resultFolder: { type: 'string' },
        },
        required: ['accessToken']
    },

    createJob: {
        type: 'object',
        properties: {
            jupyterhubApiToken: { type: 'string' },
            maintainer: { type: 'string' },
            hpc: { type: 'string' },
            user: { type: 'string' },
            password: { type: 'string' }
        },
        required: ['maintainer']
    },

    getJob: {
        type: 'object',
        properties: {
            jupyterhubApiToken: { type: 'string' },
            accessToken: { type: 'string' }
        },
        required: ['accessToken']
    },

    getFile: {
        type: 'object',
        properties: {
            jupyterhubApiToken: { type: 'string' },
            accessToken: { type: 'string' },
            fileUrl: { type: 'string' }
        },
        required: ['accessToken', 'fileUrl']
    }    
}

function requestErrors(v) {
    if (v.valid) return []
    var errors = []
    for (var i in v.errors) errors.push(v.errors[i].message)
    return errors
}

function setDefaultValues(data, defaults) {
    for (var k in defaults) {
        if (data[k] == undefined) data[k] = defaults[k]
    }
    return data
}

// index
app.get('/', (req, res) => {
    res.json({ message: 'hello world' })
})

// user
app.get('/user', (req, res) => {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.user))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors })
        res.status(402)
        return
    }

    console.log(res.locals.username)
    if (!res.locals.username) {
        res.json({ error: "invalid token" })
        res.status(402)
        return
    }
    res.json({ username: res.locals.username })
})

app.get('/user/job', async (req, res) => {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.user))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors })
        res.status(402)
        return
    }

    if (!res.locals.username) {
        res.json({ error: "invalid token" })
        res.status(402)
        return
    }

    var connection = await db.connect()

    const jobs = await connection
        .getRepository(Job)
        .find({ userId: res.locals.username })

    res.json({ jobs: jobs })
})

// list info
app.get('/hpc', function (req, res) {
    var parseHPC = (dest: {[key: string]: hpcConfig}) => {
        var out = {}
        for (var i in dest) {
            var d: hpcConfig = JSON.parse(JSON.stringify(dest[i])) // hard copy
            delete d.community_login
            delete d.root_path
            out[i] = d
        }
        return out
    }
    res.json({ hpc: parseHPC(hpcConfigMap) })
})

app.get('/maintainer', function (req, res) {
    var parseMaintainer = (dest: {[key: string]: maintainerConfig}) => {
        var out = {}
        for (var i in dest) {
            var d: maintainerConfig = JSON.parse(JSON.stringify(dest[i])) // hard copy
            out[i] = d
        }
        return out
    }
    res.json({ maintainer: parseMaintainer(maintainerConfigMap) })
})

app.get('/container', function (req, res) {
    var parseContainer = (dest: {[key: string]: containerConfig}) => {
        var out = {}
        for (var i in dest) {
            var d: containerConfig = JSON.parse(JSON.stringify(dest[i])) // hard copy
            if (!(i in ['dockerfile', 'dockerhub'])) {
                out[i] = d
            }
        }
        return out
    }
    res.json({ container: parseContainer(containerConfigMap) })
})

app.get('/git', async function (req, res) {
    var parseGit = async (dest: Git[]) => {
        var out = {}
        for (var i in dest) {
            var gitFolder = new GitFolder(dest[i].id)
            try {
                var executableManifest = await gitFolder.getExecutableManifest()
                out[dest[i].id] = {
                    name: executableManifest.name,
                    container: executableManifest.container,
                    repository: dest[i].address,
                    commit: dest[i].sha
                }
            } catch (e) {
                console.error(`cannot clone git: ${e.toString()}`)
            }
        }
        return out
    }

    var connection = await db.connect()
    var gitRepo = connection.getRepository(Git)
    var gits = await gitRepo.find({
        order: {
            id: "DESC"
        }
    })
    res.json({ git: await parseGit(gits) })
})

// file
app.post('/file', async function (req: any, res) {
    if (res.statusCode == 402) return

    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors })
        res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] })
        res.status(401)
        return
    }

    try {
        var maintainerConfig = maintainerConfigMap[job.maintainer]
        if (maintainerConfig.executable_folder.from_user) {
            var fileConfig = maintainerConfig.executable_folder.file_config
            var file: LocalFolder = await FileSystem.createLocalFolder(fileConfig)
            await file.putFileFromZip(req.files.file.tempFilePath)
        }
        res.json({ file: file.getURL() })
    } catch (e) {
        res.json({ error: e.toString() })
        res.status(402)
        return
    }
})

app.get('/file', async function (req: any, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getFile))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors })
        res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] })
        res.status(401)
        return
    }

    if (!job.finishedAt) {
        res.json({ error: `job is not finished, please try it later`, })
        res.status(402)
        return
    }

    try {
        var folder = FileSystem.getFolderByURL(body.fileUrl, ['local', 'globus'])
        if (folder instanceof LocalFolder) {
            var dir = await folder.getZip()
            res.download(dir)
        } else if (folder instanceof GlobusFolder) {
            var hpcConfig = hpcConfigMap[job.hpc]
            var from = FileSystem.getGlobusFolderByHPCConfig(hpcConfigMap[job.hpc], `${job.id}/result`)
            var taskId = await GlobusUtil.initTransfer(from, folder, hpcConfig, job.id)
            await globusTaskList.append(job, taskId)
            res.json({ message: `Globus transfer task start with task_id ${taskId}` })
        }
    } catch (e) {
        res.json({ error: `cannot get file by url [${body.fileUrl}]`, messages: [e.toString()] })
        res.status(402)
        return
    }
})

app.get('/file/:jobId/globus_task_status', async function (req: any, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    var taskIds = await globusTaskList.get(job)
    var out = {}

    for (var i in taskIds) {
        var taskId = taskIds[i]
        out[taskId] = await GlobusUtil.queryTransferStatus(taskId, hpcConfigMap[job.hpc])
        if (out[taskId] in ['SUCCEEDED', 'FAILED']) await globusTaskList.remove(job, taskId)
    }

    res.json(out)
})

// job
app.post('/job', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.createJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    var maintainerName = body.maintainer
    var maintainer = maintainerConfigMap[maintainerName]
    if (maintainer === undefined) {
        res.json({ error: "unrecognized maintainer", message: null }); res.status(401)
        return
    }

    var hpcName = body.hpc ? body.hpc : maintainer.default_hpc
    var hpc = hpcConfigMap[hpcName]
    if (hpc === undefined) {
        res.json({ error: "unrecognized hpc", message: null }); res.status(401)
        return
    }

    try {
        if (hpc.is_community_account) {
            await guard.validateCommunityAccount()
        } else {
            await guard.validatePrivateAccount(hpcName, body.user, body.password)
        }
    } catch (e) {
        res.json({ error: "invalid credentials", messages: [e.toString()] }); res.status(401)
        return
    }

    var connection = await db.connect()
    var jobRepo = connection.getRepository(Job)

    var job: Job = new Job()
    job.id = guard.generateID()
    job.userId = res.locals.username ? res.locals.username : null
    job.secretToken = await guard.issueJobSecretToken()
    job.maintainer = maintainerName
    job.hpc = hpcName
    job.param = {}
    job.env = {}
    if (!hpc.is_community_account) job.credentialId = await guard.registerCredential(body.user, body.password)
    await jobRepo.save(job)

    res.json(job)
})

app.put('/job/:jobId', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.updateJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    try {
        var connection = await db.connect()
        await connection.createQueryBuilder()
            .update(Job)
            .where('id = :id', { id:  req.params.jobId })
            .set(Helper.prepareDataForDB(body, ['param', 'env', 'slurm', 'executableFolder', 'dataFolder', 'resultFolder']))
            .execute()

        var jobRepo = connection.getRepository(Job)
        var job =  await jobRepo.findOne(job.id)
    } catch (e) {
        res.json({ error: e.toString() }); res.status(402)
        return
    }

    guard.updateJobAccessTokenCache(body.accessToken, job)
    res.json(Helper.job2object(job))
})

app.post('/job/:jobId/submit', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors })
        res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    if (job.queuedAt) {
        res.json({ error: "job already submitted or in queue", messages: [] }); res.status(401)
        return 
    }

    try {
        await supervisor.pushJobToQueue(job)
        // update status
        var connection = await db.connect()
        job.queuedAt = new Date()
        await connection.createQueryBuilder()
            .update(Job)
            .where('id = :id', { id:  job.id })
            .set({ queuedAt: job.queuedAt })
            .execute()
    } catch (e) {
        res.json({ error: e.toString() }); res.status(402)
        return
    }

    res.json(Helper.job2object(job))
})

app.put('/job/:jobId/pause', async function (req, res) {
    
})

app.put('/job/:jobId/resume', async function (req, res) {
    
})

app.put('/job/:jobId/cancel', async function (req, res) {
    
})

app.get('/job/:jobId/events', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken, true)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    res.json(job.events)
})

app.get('/job/:jobId/logs', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken, true)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    res.json(job.logs)
})

// same as /job/:jobId
app.get('/job/get-by-token', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken, true)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    res.json(Helper.job2object(job))
})

app.get('/job/:jobId', async function (req, res) {
    var body = req.body
    var errors = requestErrors(validator.validate(body, schemas.getJob))

    if (errors.length > 0) {
        res.json({ error: "invalid input", messages: errors }); res.status(402)
        return
    }

    try {
        var job = await guard.validateJobAccessToken(body.accessToken, true)
    } catch (e) {
        res.json({ error: "invalid access token", messages: [e.toString()] }); res.status(401)
        return
    }

    if (job.id != req.params.jobId) {
        res.json({ error: "invalid access", messages: [] }); res.status(401)
        return
    }

    res.json(Helper.job2object(job))
})

app.listen(config.server_port, config.server_ip, () => console.log('supervisor server is up, listening to port: ' + config.server_port))
