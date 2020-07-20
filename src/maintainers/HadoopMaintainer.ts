import BaseMaintainer from './BaseMaintainer'

class HadoopMaintainer extends BaseMaintainer {
    define() {
        this.allowedEnv = {
            A: 'number',
            B: 'string'
        }
    }

    async onInit() {
        var pipeline = [
            'ls'
        ]
        var out = await this.connect(pipeline)
        if (out.length > 0) {
            this.emitEvent('JOB_INITIALIZED', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
        }
    }

    async onMaintain() {
        var pipeline = [
            'ls',
            'echo $A',
            'echo $B',
            'echo $C',
            (prev) => {
                if (prev.out == '\n') {
                    throw new Error('error')
                }
                return ''
            },
            'echo $A'
        ]
        var out = await this.connect(pipeline)
        if (out.length > 0) {
            this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] finished')
        }
    }
}

export default HadoopMaintainer