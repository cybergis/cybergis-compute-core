import SingularityConnector from '../connectors/SingularityConnector'
import BaseMaintainer from './BaseMaintainer'
import { LocalFolder, GitFolder } from '../FileSystem'
import XSEDEUtil from '../lib/XSEDEUtil'
import { ResultFolderContentManager } from '../lib/JobUtil'
import { executableManifest } from '../types'

export default class CommunityContributionMaintainer extends BaseMaintainer {

    public connector: SingularityConnector

    public executableFolder: GitFolder

    public resultFolderContentManager: ResultFolderContentManager = new ResultFolderContentManager()

    public executableManifest: executableManifest

    onDefine() {
        // define connector
        this.connector = this.getSingularityConnector()
    }

    async onInit() {
        try {
            this.executableManifest = await this.executableFolder.getExecutableManifest()
            this.connector.execExecutableManifestWithinImage(this.executableManifest, this.slurm)
            await this.connector.submit()
            this.emitEvent('JOB_INIT', 'job [' + this.id + '] is initialized, waiting for job completion')
            XSEDEUtil.jobLog(this.connector.slurm_id, this.hpc, this.job)
        } catch (e) {
            this.emitEvent('JOB_RETRY', 'job [' + this.id + '] encountered system error ' + e.toString())
        }
    }

    async onMaintain() {
        try {
            var status = await this.connector.getStatus()
            if (status == 'C' || status == 'CD' || status == 'UNKNOWN') {
                await this.connector.getSlurmStdout()
                await this.connector.getSlurmStderr()
                if (this.resultFolder instanceof LocalFolder) {
                    await this.connector.download(this.connector.getRemoteResultFolderPath(), this.resultFolder)
                    await this.updateJob({
                        resultFolder: this.resultFolder.getURL()
                    })
                }
                // ending condition
                this.emitEvent('JOB_ENDED', 'job [' + this.id + '] finished')
                var usage = await this.connector.getUsage()
                this.updateJob(usage)
                XSEDEUtil.jobLog(this.connector.slurm_id, this.hpc, this.job) // for backup submit
                var contents = await this.connector.getRemoteResultFolderContent()
                var defaultResultFolderDownloadablePath = this.executableManifest.default_result_folder_downloadable_path
                if (defaultResultFolderDownloadablePath) {
                    // bring default downloadable to front (for frontend display)
                    contents.sort( (a, b) => a == defaultResultFolderDownloadablePath ? -1 : b == defaultResultFolderDownloadablePath ? 1 : 0 )
                    if (defaultResultFolderDownloadablePath[0] != '/') {
                        defaultResultFolderDownloadablePath = `/${defaultResultFolderDownloadablePath}`
                        contents.sort( (a, b) => a == defaultResultFolderDownloadablePath ? -1 : b == defaultResultFolderDownloadablePath ? 1 : 0 )
                    }
                }
                await this.resultFolderContentManager.put(this.id, contents)
            } else if (status == 'ERROR' || status == 'F' || status == 'NF') {
                // failing condition
                this.emitEvent('JOB_FAILED', 'job [' + this.id + '] failed with status ' + status)
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
