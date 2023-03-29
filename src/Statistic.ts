import DB from "./DB";
import { Job } from "./models/Job";

export default class Statistic {
  private db = new DB();

  public async getRuntimeByJobId(jobId: string) {
    const connection = await this.db.connect();
    const statistic = await connection
      .getRepository(Job)
      .createQueryBuilder("job")
      .where(
        "job.id = :id",
        { id: jobId }
      )
      .getRawOne();

    var difference = statistic["job_finishedAt"] - statistic["job_initializedAt"]
    var secondsDifference = Math.floor(difference/1000);
    
    console.log("second diff:")
    console.log(secondsDifference)
    return secondsDifference

  }

  public async getRuntimeTotal() {
    const connection = await this.db.connect();
    const statisticTotal = await connection
      .getRepository(Job)
      .createQueryBuilder("job")
      .select(
        "SUM(TIMESTAMPDIFF(SECOND,job.initializedAt,job.finishedAt)) as STATISTIC"
      )
      .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
      .getRawOne();

    const statisticByHPC = await connection
      .getRepository(Job)
      .createQueryBuilder("job")
      .select(
        "SUM(TIMESTAMPDIFF(SECOND,job.initializedAt,job.finishedAt)) as STATISTIC, job.hpc as HPC"
      )
      .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
      .groupBy("hpc")
      .getRawMany();

    console.log(statisticTotal);
    console.log(statisticByHPC);



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
