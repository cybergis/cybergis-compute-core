import SingularityConnector from '../connectors/SingularityConnector'
import BaseMaintainer from './BaseMaintainer'
import { LocalFolder, GitFolder } from '../FileSystem'
import XSEDEUtil from '../lib/XSEDEUtil'
import {config} from "../types";
import axios from "axios"


export default class CommunityContributionMaintainer extends BaseMaintainer {

    public connector: SingularityConnector

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
            //XSEDEUtil.jobLog(this.connector.slurm_id, this.hpc, this.job)
            this.emitEvent('JOB_INIT', this.hpc.xsede_job_log_credential.toString())

            if (this.hpc.xsede_job_log_credential)
            {


                var params = {
                    xsederesourcename: this.hpc.xsede_job_log_credential.xsederesourcename,
                    jobid: this.connector.slurm_id,
                    gatewayuser: this.job.userId,
                    submittime: XSEDEUtil.formateDate(this.job.createdAt),
                    //usage: XSEDEUtil.diffInSeconds(job.finishedAt, job.createdAt),
                    //apikey: hpc.xsede_job_log_credential.apikey
                }

                await axios.post(`${XSEDEUtil.jobLogURL}`, params, {headers: {"XA-API-Key": this.hpc.xsede_job_log_credential.apikey}})
                    .then((response) => {
                          this.emitEvent('JOB_INIT', response.toString())
                          })
                      .catch((error) => {
                          this.emitEvent('JOB_INIT', error)
                      })
                console.error('XSEDE job logged: ', params)
            }





            this.emitEvent('JOB_INIT', 'job [' + this.id + '] info logged by XSEDE')
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
