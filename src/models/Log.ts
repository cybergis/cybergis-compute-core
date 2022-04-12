import {Entity, Column, ManyToOne, PrimaryGeneratedColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate} from "typeorm"
import {Job} from "./Job"

@Entity({name: "logs"})
export class Log {
    @PrimaryGeneratedColumn()
    id: number
    
    @Column()
    jobId: string

    @Column("text")
    message: string

    @ManyToOne(type => Job, (job: Job) => job.logs)
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
