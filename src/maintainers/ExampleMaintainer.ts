import BaseMaintainer from './BaseMaintainer'

class ExampleMaintainer extends BaseMaintainer {
    define() {
        this.allowedEnv = {
            A: 'number',
            B: 'string'
        }
    }

    async onInit() {
        await this.runPython('Example/init.py', [])

        var pipeline = [
            'ls'
        ]
        var out = await this.connect(pipeline, {})
        if (out.length > 0) {
            // condition when job is initialized
            // if job fail, please do not emit JOB_INITIALIZED event
            // failed initialization can be rebooted
            this.emitEvent('JOB_INITIALIZED', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
        }
    }

    async onMaintain() {
        var pipeline = [
            'ls',
            'echo $A',
            'echo $B',
            'echo $C',
            (prev, self) => {
                self.emitEvent('JOB_CUSTOM_EVENT', 'emit a custom event...')
                if (prev.out == '\n') {
                    throw new Error('error')
                }
                return ''
            },
            'echo $A'
        ]
        var out = await this.connect(pipeline, {})
        if (out.length > 0) {
            // ending condition
            this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] finished')
        } else {
            // failing condition
            this.emitEvent('JOB_FAILED', 'job [' + this.manifest.id + '] failed')
        }
    }
}

export default ExampleMaintainer