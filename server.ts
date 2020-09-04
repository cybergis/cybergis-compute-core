import Guard from './src/Guard'
import Supervisor from './src/Supervisor'
import File from './src/File'
import Helper from './src/Helper'
import constant from './src/constant'
import { FileFormatError, FileStructureError } from './src/errors'
const bodyParser = require('body-parser')
const config = require('./config.json')
const Validator = require('jsonschema').Validator;
const express = require('express')
const requestIp = require('request-ip')
const fileUpload = require('express-fileupload')

const tmpDir = __dirname + '/data/tmp'

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(requestIp.mw({ attributeName: 'ip' }))
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: tmpDir,
    safeFileNames: true,
    limitHandler: (req, res, next) => {
        res.json({
            error: "file too large"
        })
        res.status(402)
    }
}))

const guard = new Guard()
const supervisor = new Supervisor()
const file = new File()
const validator = new Validator()

file.clearTmpFiles()

if (!config.isTesting) {
    if (process.platform == "linux") {
        var iptablesRules = []
        for (var k in config.clientIPs) {
            iptablesRules.push('INPUT -p tcp -s ' + config.clientIPs[k] + ' --dport ' + config.serverPort + ' -j ACCEPT')
        }
        iptablesRules.push('INPUT -p tcp -s localhost --dport ' + config.serverPort + ' -j ACCEPT')
        iptablesRules.push('INPUT -p tcp --dport ' + config.serverPort + ' -j DROP')
        Helper.setupFirewallRules(iptablesRules, 'linux')
    }

    Helper.onExit(function () {
        if (process.platform == "linux") {
            Helper.teardownFirewallRules(iptablesRules, 'linux')
        }
    })
}

var schemas = {
    manifest: {
        type: 'object',
        properties: {
            aT: {
                type: 'string'
            },
            dest: {
                type: 'string'
            },
            env: {
                type: 'object'
            },
            file: {
                type: 'string'
            },
            payload: {
                type: 'object'
            }
        },
        required: ['aT', 'dest']
    },
    credentials: {
        type: 'object',
        properties: {
            destination: {
                type: 'string'
            },
            user: {
                type: 'string'
            },
            password: {
                type: 'string'
            }
        },
        required: ['destination']
    },
    accessToken: {
        type: 'object',
        properties: {
            aT: {
                type: 'string'
            }
        },
        required: ['aT']
    }
}

function requestErrors(v) {
    if (v.valid) {
        return []
    }

    var errors = []

    for (var i in v.errors) {
        errors.push(v.errors[i].message)
    }

    return errors
}

function setDefaultValues(data, defaults) {
    for (var k in defaults) {
        if (data[k] == undefined) {
            data[k] = defaults[k]
        }
    }
    return data
}

// index
app.get('/', (req, res) => {
    res.json({ message: 'hello world' })
})

// guard
app.post('/guard/secretToken', async function (req, res) {
    var cred = req.body
    var errors = requestErrors(validator.validate(cred, schemas['credentials']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    var server = constant.destinationMap[cred.destination]

    if (server === undefined) {
        res.json({
            error: "unrecognized destination " + cred.destination,
            message: ''
        })
        res.status(401)
        return
    }

    try {
        if (server.isCommunityAccount) {
            var sT = await guard.issueSecretTokenForCommunityAccount(cred.destination, server.communityAccountSSH.user)
        } else {
            var sT = await guard.issueSecretTokenForPrivateAccount(cred.destination, cred.user, cred.password)
        }
    } catch (e) {
        res.json({
            error: "invalid credentials",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    res.json({
        secretToken: sT
    })
})

// supervisor
app.post('/supervisor', async function (req, res) {
    var manifest = req.body
    var errors = requestErrors(validator.validate(manifest, schemas['manifest']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    manifest = setDefaultValues(manifest, {
        env: {},
        payload: {}
    })

    try {
        manifest = await guard.validateAccessToken(manifest)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    try {
        manifest = await supervisor.add(manifest)
    } catch (e) {
        res.json({
            error: e.toString()
        })
        res.status(402)
        return
    }
    manifest = Helper.hideCredFromManifest(manifest)
    res.json(manifest)
})

app.post('/supervisor/upload', async function (req, res) {
    if (res.statusCode == 402) {
        return
    }

    var aT = req.body
    var errors = requestErrors(validator.validate(aT, schemas['accessToken']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    try {
        var manifest = await guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    try {
        var fileID = await file.store(manifest.uid, manifest.dest, req.files.file.tempFilePath)
        res.json({
            file: fileID
        })
    } catch (e) {
        console.log(e)
        res.json({
            error: e.toString()
        })
        res.status(402)
        return
    }
})

app.get('/supervisor/download/:jobID', async function (req, res) {
    var aT = req.body
    var errors = requestErrors(validator.validate(aT, schemas['accessToken']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    try {
        await guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    var jobID = req.params.jobID
    var dir = await supervisor.getDownloadDir(jobID)

    if (dir != null) {
        res.download(dir)
    } else {
        res.json({
            error: "job id " + jobID + " does not have a download file"
        })
    }
})

app.get('/supervisor/:jobID', async function (req, res) {
    var aT = req.body
    var errors = requestErrors(validator.validate(aT, schemas['accessToken']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    try {
        var manifest = await guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    res.json(await supervisor.status(manifest.uid, req.params.jobID))
})

app.get('/supervisor', async function (req, res) {
    var aT = req.body
    var errors = requestErrors(validator.validate(aT, schemas['accessToken']))

    if (errors.length > 0) {
        res.json({
            error: "invalid input",
            messages: errors
        })
        res.status(402)
        return
    }

    try {
        var manifest = await guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    res.json(await supervisor.status(manifest.uid))
})

app.listen(config.serverPort, () => console.log('supervisor server is up, listening to port: ' + config.serverPort))
