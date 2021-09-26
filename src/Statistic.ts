import DB from './DB'
import { Job } from './models/Job';

export default class Statistic {
    private db = new DB()

    public async getByJobId(jobId: string) {
        const connection = await this.db.connect()
        const statistic = await connection
            .getRepository(Job)
            .createQueryBuilder("job")
            .select('TIMESTAMPDIFF(SECOND,job.initializedAt,job.finishedAt) as STATISTIC')
            .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL AND id = :id", {id: jobId})
            .getRawOne()
        console.log(statistic)
    }

    public async getTotal() {
        const connection = await this.db.connect()
        const statistic = await connection
            .getRepository(Job)
            .createQueryBuilder("job")
            .select('SUM(TIMESTAMPDIFF(SECOND,job.initializedAt,job.finishedAt)) as STATISTIC')
            .where("job.initializedAt IS NOT NULL AND job.finishedAt IS NOT NULL")
            .getRawOne()
        console.log(statistic)
    }
}

