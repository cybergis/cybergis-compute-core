import { config, hpcConfig, maintainerConfig, gitConfig, containerConfig } from '../src/types'

const rawConfig = require('../config.json')
const rawHpc = require('./hpc.json')
const rawMaintainer = require('./maintainer.json')
const rawGitConfig = require('./git.json')
const rawContainerConfig = require('./container.json')

const config: config = JSON.parse(JSON.stringify(rawConfig))

var hpcConfigMap: {[key: string]: hpcConfig} = {}
for (var i in rawHpc) {
    hpcConfigMap[i] = JSON.parse(JSON.stringify(rawHpc[i]))
}

var maintainerConfigMap: {[key: string]: maintainerConfig} = {}
for (var i in rawMaintainer) {
    maintainerConfigMap[i] = JSON.parse(JSON.stringify(rawMaintainer[i]))
}

var gitConfigMap: {[key: string]: gitConfig} = {}
for (var i in rawGitConfig) {
    gitConfigMap[i] = JSON.parse(JSON.stringify(rawGitConfig[i]))
}

var containerConfigMap: {[key: string]: containerConfig} = {}
for (var i in containerConfigMap) {
    containerConfigMap[i] = JSON.parse(JSON.stringify(containerConfigMap[i]))
}

export { config, hpcConfigMap, maintainerConfigMap, gitConfigMap, containerConfigMap }
