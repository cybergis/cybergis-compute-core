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
            'python3 ' + path.join(this.workspacePath, 'index.py'),
            (prev, self) => {
                console.log(prev)
                self.emitEvent('JOB_CUSTOM_EVENT', 'emit a custom event...')
                if (prev.out == '\n') {
                    throw new Error('error')
                }
                return ''
            }
        ]

        await this.runBash(pipeline, {})
        this.registerDownloadDir(this.workspacePath)
    }
}

export default SparkMaintainer