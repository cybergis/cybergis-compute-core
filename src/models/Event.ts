import {Entity, Column, PrimaryGeneratedColumn, ManyToOne, DeleteDateColumn, BeforeInsert, BeforeUpdate} from "typeorm"
import {Job} from "./Job"

@Entity({name: "events"})
export class Event {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    jobId: string

    @Column()
    type: string

    @Column("text")
    message: string

    @ManyToOne(type => Job, (job: Job) => job.events)
    job: Job

    @Column({type: 'bigint', transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    createdAt: Date

    @Column({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    updatedAt: Date

    @DeleteDateColumn({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    deletedAt: Date

    @BeforeInsert()
    async setCreatedAt() {
        this.createdAt = new Date()
    }

    @BeforeUpdate()
    async setUpdatedAt() {
        return this.updatedAt = new Date()
    }
}