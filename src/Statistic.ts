import DB from './DB'
import { Job } from './models/Job';

export default class Statistic {
    private db = new DB()

    public getByJobId(jobId: string) {

    }

    public async getTotal() {
        const connection = await this.db.connect()
        const statistic = await connection
            .getRepository(Job)
            .createQueryBuilder("job")
            .select('TIMESTAMPDIFF(SECOND,job.initializedAt,job.finishedAt) as STATISTIC')
            .where("job.initializedAt NOT NULL AND job.finishedAt NOT NULL")
            .getOne()
        console.log(statistic)
    }
}

