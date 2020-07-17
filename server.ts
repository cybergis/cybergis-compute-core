import Guard from './src/Guard'
import { manifest } from './src/types'
import Supervisor from './src/Supervisor'
import Helper from './src/Helper'
const bodyParser = require('body-parser')
var Validator = require('jsonschema').Validator;
const express = require('express')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

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
        required: ['destination', 'user', 'password']
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

    try{
        var sT = await guard.issueSecretToken(cred.destination, cred.user, cred.password)
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

app.listen(3000, () => console.log(`Example app listening at http://localhost:`))
