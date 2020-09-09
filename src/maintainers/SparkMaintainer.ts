import BaseMaintainer from './BaseMaintainer'
const path = require('path')

class SparkMaintainer extends BaseMaintainer {

    private workspacePath

    define() {
        this.allowedEnv = {
            //
        }
    }

    async onInit() {
        this.injectRuntimeFlagsToFile('index.py', 'python')
        this.workspacePath = await this.upload(await this.getRemoteHomePath())
        this.emitEvent('JOB_INITIALIZED', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
    }

    async onMaintain() {
        var pipeline = [
            'python3 ' + path.join(this.workspacePath, 'index.py')
        ]

        await this.runBash(pipeline, {})
        this.registerDownloadDir(this.workspacePath)
        this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] is complete')
    }
}

export default SparkMaintainer