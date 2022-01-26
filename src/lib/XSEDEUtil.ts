import axios from "axios"
import { config } from "../../configs/config"
import { Job } from "../models/Job"
import { hpcConfig } from "../types"

export default class XSEDEUtil {
    static jobLogURL = 'https://xsede-xdcdb-api.xsede.org/gateway/v2/job_attributes'
    
    static async jobLog(slurm_id: string, hpc: hpcConfig, job: Job) {
        if (!hpc.xsede_job_log_credential) return

        try {
            var params = {
                xsederesourcename: hpc.xsede_job_log_credential.xsederesourcename,
                jobid: slurm_id,
                gatewayuser: job.userId,
                //submittime: XSEDEUtil.formateDate(job.createdAt),
                //usage: XSEDEUtil.diffInSeconds(job.finishedAt, job.createdAt),
                apikey: hpc.xsede_job_log_credential.apikey
            }

            await axios.get(`${XSEDEUtil.jobLogURL}`, { params })
            if (config.is_testing) console.log('XSEDE job logged: ', params)
            console.log('XSEDE job logged: ', params)
        } catch(e) {
            // best effort
        }
    }

    static formateDate(date: Date): string {
        // trust accessToken for an hour
        var y = date.getUTCFullYear()
        var m = date.getUTCMonth() + 1
        var d = date.getUTCDate()
        var h = date.getUTCHours()
        var min = date.getUTCMinutes()

        var mStr = m < 10 ? '0' + m.toString() : m.toString()
        var dStr = d < 10 ? '0' + d.toString() : d.toString()
        var hStr = h < 10 ? '0' + h.toString() : h.toString()
        var minStr = min < 10 ? '0' + min.toString() : min.toString()

        return `${y}-${mStr}-${dStr} ${hStr}:${minStr} UTC`
    }

    static diffInSeconds(a, b) {
        return Math.abs(a - b) / 1000
    }
}