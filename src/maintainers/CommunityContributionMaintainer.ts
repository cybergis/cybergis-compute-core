import SingularityConnector from '../connectors/SingularityConnector'
import BaseMaintainer from './BaseMaintainer'
import { LocalFolder, GitFolder } from '../FileSystem'

export default class CommunityContributionMaintainer extends BaseMaintainer {

    public connector: SingularityConnector

    public resultFolder: LocalFolder

    public executableFolder: GitFolder

    onDefine() {
        // define connector
        this.connector = this.getSingularityConnector()
    }

    async onInit() {
        try {
            var executableManifest = await this.executableFolder.getExecutableManifest()
            this.connector.execExecutableManifestWithinImage(executableManifest, this.slurm)
            await this.connector.submit()
            this.emitEvent('JOB_INIT', 'job [' + this.id + '] is initialized, waiting for job completion')
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
        }
    }

    async onMaintain() {
        try {
            var status = await this.connector.getStatus()
            if (status == 'C' || status == 'UNKNOWN') {
                await this.connector.getSlurmOutput()
                // ending condition
                await this.connector.rm(this.connector.getRemoteExecutableFolderPath()) // clear executable files
                this.emitEvent('JOB_ENDED', 'job [' + this.id + '] finished')
            } else if (status == 'ERROR') {
                // failing condition
                this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed')
            }
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
        }
    }

    async onPause() {
        await this.connector.pause()
    }

    async onResume() {
        await this.connector.resume()
    }

    async onCancel() {
        await this.connector.cancel()
    }
}
