import Guard from './src/Guard'
import Supervisor from './src/Supervisor'
import Helper from './src/Helper'
import constant from './src/constant'
const bodyParser = require('body-parser')
const config = require('./config.json')
var Validator = require('jsonschema').Validator;
const express = require('express')
const requestIp = require('request-ip')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(requestIp.mw({ attributeName: 'ip' }))

var guard = new Guard()
var supervisor = new Supervisor()
var validator = new Validator()

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
        required: ['destination', 'user']
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
            var sT = await guard.issueSecretTokenViaWhitelist(cred.destination, server.communityAccountUser, req.ip)
        } else {
            var sT = await guard.issueSecretTokenViaSSH(cred.destination, cred.user, cred.password)
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
app.post('/supervisor', function (req, res) {
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
        manifest = guard.validateAccessToken(manifest)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    manifest = supervisor.add(manifest)
    manifest = Helper.hideCredFromManifest(manifest)
    res.json(manifest)
})

app.get('/supervisor/:jobID', function (req, res) {
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
        aT = guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    res.json(supervisor.status(aT.uid, req.params.jobID))
})

app.get('/supervisor', function (req, res) {
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
        aT = guard.validateAccessToken(aT)
    } catch (e) {
        res.json({
            error: "invalid access token",
            messages: [e.toString()]
        })
        res.status(401)
        return
    }

    res.json(supervisor.status(aT.uid))
})

app.listen(config.serverPort, () => console.log('supervisor server is up, listening to port: ' + config.serverPort))

Helper.onExit(function () {
    console.log('safely exiting supervisor server...')
    supervisor.destroy()
})