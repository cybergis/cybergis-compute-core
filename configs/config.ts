import { config, hpcConfig, maintainerConfig } from '../src/types'

const rawConfig = require('../config.json')
const rawHpc = require('./hpc.json')
const rawMaintainer = require('./maintainer.json')

const config: config = JSON.parse(JSON.stringify(rawConfig))

var hpcConfigMap: {[key: string]: hpcConfig} = {}
for (var i in rawHpc) {
    hpcConfigMap[i] = JSON.parse(JSON.stringify(rawHpc[i]))
}

var maintainerConfigMap: {[key: string]: maintainerConfig} = {}
for (var i in rawMaintainer) {
    maintainerConfigMap[i] = JSON.parse(JSON.stringify(rawMaintainer[i]))
}

export { config, hpcConfigMap, maintainerConfigMap }
