import BaseConnector from '../connectors/BaseConnector'
import BaseMaintainer from './BaseMaintainer'

export default class HelloWorldBasicMaintainer extends BaseMaintainer {

    public connector: BaseConnector

    define() {
        // define environment params
        this.envParamDefault = {
            A: 'default_value'
        }

        this.envParamValidators = {
            A: (val) => this.validator.isAlpha(val)
        }

        // define connector
        this.connector = this.getBaseConnector()
    }

    async onInit() {
        var commands = ['cd ..', 'ls']
        var result = await this.connector.exec(commands, {
            cwd: '~'
        })

        if (result.stderr.length != null) {
            this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed')
        }

        if (result.stdout.length != null) {
            // condition when job is initialized
            // if job fail, please do not emit JOB_INITIALIZED event
            // failed initialization can be rebooted
            this.emitEvent('JOB_INIT', 'job [' + this.id + '] is initialized, waiting for job completion')
        }
    }

    async onMaintain() {
        var out = await this.connector.homeDirectory()
        if (out != null) {
            // ending condition
            this.emitEvent('JOB_ENDED', 'job [' + this.id + '] finished')
        } else {
            // failing condition
            this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed')
        }
    }
}
