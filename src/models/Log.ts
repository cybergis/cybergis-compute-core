import {Entity, Column, ManyToOne, PrimaryGeneratedColumn} from "typeorm"
import {Job} from "./Job"

@Entity({name: "logs"})
export class Log {
    @PrimaryGeneratedColumn()
    id: number
    
    @Column()
    jobId: string

    @Column("longtext")
    message: string

    @ManyToOne(type => Job, (job: Job) => job.logs)
    job: Job

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    createdAt: Date

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    updatedAt: Date

    @Column({type: 'timestamp', default: null})
    deletedAt: Date
}
