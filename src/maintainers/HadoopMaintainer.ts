import BaseMaintainer from './BaseMaintainer'

class HadoopMaintainer extends BaseMaintainer {
    async onInit() {
        var commands = [
            'ls'
        ]
        var out = await this.connect(commands)
        if (out.length > 0) {
            this.emitEvent('JOB_INITIALIZED', 'job [' + this.manifest.id + '] is initialized, waiting for job completion')
        }
    }

    async onMaintain() {
        var commands = [
            'ls'
        ]
        var out = await this.connect(commands)
        if (out.length > 0) {
            this.emitEvent('JOB_ENDED', 'job [' + this.manifest.id + '] finished')
        }
    }
}

export default HadoopMaintainer