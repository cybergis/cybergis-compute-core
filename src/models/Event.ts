import {Entity, Column, PrimaryGeneratedColumn, ManyToOne} from "typeorm"
import {Job} from "./Job"

@Entity({name: "events"})
export class Event {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    jobId: string

    @Column()
    type: string

    @Column("longtext")
    message: string

    @ManyToOne(type => Job, (job: Job) => job.events)
    job: Job

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    createdAt: Date

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    updatedAt: Date

    @Column({type: 'timestamp', default: null})
    deletedAt: Date
}