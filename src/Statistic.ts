import DB from "./DB";
import { Job } from "./models/Job";

/**
 * Wrapper class for requesting statistics from the database.
 */
export default class Statistic {
  private db = new DB();

  /**
   * Returns the runtime of a job given its jobId.
   *
   * @param jobId id of the job
   * @returns runtime of jof (initialization time - finish time)
   */
  public async getRuntimeByJobId(jobId: string) {
    const connection = await this.db.connect();
    const statistic = await connection
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
   * 
   * @returns dictionary of results, including total and statistics by HPC
   */
  public async getRuntimeTotal() {
    const connection = await this.db.connect();

    const statisticTotal = await connection
      .getRepository(Job)
      .createQueryBuilder("job")
      .select("SUM(ABS(job.initializedAt - job.finishedAt)) as STATISTIC")
      .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
      .getRawOne();

    const statisticByHPC = await connection
      .getRepository(Job)
      .createQueryBuilder("job")
      .select(
        "SUM(ABS(job.initializedAt - job.finishedAt)) as STATISTIC, job.hpc as HPC"
      )
      .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
      .groupBy("hpc")
      .getRawMany();

    if (statisticTotal && statisticByHPC) {
      var out = {
        total: parseInt(statisticTotal["STATISTIC"]),
      };

      for (var i in statisticByHPC) {
        out[statisticByHPC[i]["HPC"]] = parseInt(
          statisticByHPC[i]["STATISTIC"]
        );
      }

      return out;
    } else {
      return null;
    }
  }
}
