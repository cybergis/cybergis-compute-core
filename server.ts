import Guard from './src/Guard'
import Supervisor from './src/Supervisor'
const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = 3000

var guard = new Guard()
var supervisor = new Supervisor()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.json({ message: 'hello world' })
})

// guard
app.post('/guard/secretToken', (req, res) => {
    if (req.body.accessToken === undefined) {
        res.json({ message: '' })
    }
    guard.validateAccessToken()
    res.json({ message: 'hello world' })
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))