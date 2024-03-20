import axios from "axios";
import { config } from "../../configs/config";
import { Job } from "../models/Job";
import { hpcConfig } from "../types";

/**
 * Class for accessing XSEDE commands. May be deprecated (https://www.xsede.org/)?
 */
export default class XSEDEUtil {
  static jobLogURL =
    "https://xsede-xdcdb-api.xsede.org/gateway/v2/job_attributes";

  /**
   * @static
   * Register user job to XSEDE log
   *
   * @param {string} slurmId - slurm workload manager id
   * @param {hpcConfig} hpc - hpcConfiguration
   * @param {Job} job - job object
   */
  static async jobLog(slurmId: string, hpc: hpcConfig, job: Job) {
    if (!hpc.xsede_job_log_credential) return;

    try {
      const params = {
        xsederesourcename: hpc.xsede_job_log_credential.xsederesourcename,
        jobid: slurmId,
        gatewayuser: job.userId,
        submittime: XSEDEUtil.formateDate(job.createdAt),
        // usage: XSEDEUtil.diffInSeconds(job.finishedAt, job.createdAt),
        apikey: hpc.xsede_job_log_credential.apikey,
      };

      await axios.post(`${XSEDEUtil.jobLogURL}`, {}, { params });
      if (config.is_testing) console.log("XSEDE job logged: ", params);
    } catch (e) {
      // best effort
    }
  }

  /**
   * @static
   * Convert date to string fomat
   *
   * @paramP{Date} date - date format
   * @return{string} - date in string format
   */
  static formateDate(date: Date): string {
    // trust accessToken for an hour
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    const min = date.getUTCMinutes();

    const mStr = m < 10 ? "0" + m.toString() : m.toString();
    const dStr = d < 10 ? "0" + d.toString() : d.toString();
    const hStr = h < 10 ? "0" + h.toString() : h.toString();
    const minStr = min < 10 ? "0" + min.toString() : min.toString();

    return `${y}-${mStr}-${dStr} ${hStr}:${minStr} UTC`;
  }

  /**
   * @static
   * Time difference in seconds
   *
   * @param{float} a - time input 1
   * @param{float} b - time input 2
   * @return{float} - time difference in seconds
   */
  static diffInSeconds(a, b) {
    return Math.abs(a - b) / 1000;
  }
}
