import { Job } from "../models";
import dataSource from "../utils/DB";

/**
 * Functions for requesting statistics from the database.
 */

/**
 * Returns the runtime of a job given its jobId.
 * @param jobId id of the job
 * @returns runtime of job (initialization time - finish time)
 */
export async function  getRuntimeByJobId(jobId: string): Promise<number | undefined> {
  const statistic: number | undefined = await dataSource
    .getRepository(Job)
    .createQueryBuilder("job")
    .select(
      "ABS(initializedAt - job.finishedAt) as STATISTIC, job.hpc as HPC"
    )
    .where(
      "job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL AND job.id = :id",
      { id: jobId }
    )
    .getRawOne();

  return statistic;
}

/**
 * Requests and calculates statistics relating to total runtime--both absolute and by HPC.
 * @returns dictionary of results, including total and statistics by HPC
 */
export async function  getRuntimeTotal(): Promise<Record<string, number> | null> {
    type totalStatistics = null | { STATISTIC: string } | undefined 
    const statisticTotal: totalStatistics = await (
      dataSource
        .getRepository(Job)
        .createQueryBuilder("job")
        .select("SUM(ABS(job.initializedAt - job.finishedAt)) as STATISTIC")
        .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
        .getRawOne()
    );

    type hpcStatistics = { STATISTIC: string, HPC: string }[] | null | undefined
    const statisticByHPC: hpcStatistics = await (
      dataSource
        .getRepository(Job)
        .createQueryBuilder("job")
        .select(
          "SUM(ABS(job.initializedAt - job.finishedAt)) as STATISTIC, job.hpc as HPC"
        )
        .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
        .groupBy("hpc")
        .getRawMany()
    );

    if (statisticTotal && statisticByHPC) {
      const out: Record<string, number> = {
        total: parseInt(statisticTotal.STATISTIC),
      };

      for (const statistic of statisticByHPC) {
        out[statistic.HPC] = parseInt(
          statistic.STATISTIC
        );
      }

      return out;
    } else {
      return null;
    }
}
