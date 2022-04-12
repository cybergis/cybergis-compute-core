import {Entity, Column, OneToMany, PrimaryColumn, AfterLoad, DeleteDateColumn, BeforeInsert, BeforeUpdate} from "typeorm"
import {credential, slurm} from "../types"
import {Event} from "./Event"
import {Log} from "./Log"
import BaseMaintainer from "../maintainers/BaseMaintainer"

@Entity({name: "jobs"})
export class Job {
    @PrimaryColumn()
    id: string

    @Column({nullable: true, default: null})
    userId?: string

    @Column()
    secretToken: string

    @Column()
    maintainer: string

    @Column()
    hpc: string

    @Column("text", {nullable: true, default: null})
    executableFolder: string

    @Column("text", {nullable: true, default: null})
    dataFolder: string

    @Column("text", {nullable: true, default: null})
    resultFolder: string

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: {[keys: string]: string} | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined): {[keys: string]: string} => i ? JSON.parse(i) : null
    }})
    param: {[keys: string]: string}

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: {[keys: string]: string} | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined): {[keys: string]: string} => i ? JSON.parse(i) : null
    }})
    env: {[keys: string]: string}

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: slurm | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined): slurm => i ? JSON.parse(i) : null
    }})
    slurm?: slurm

    @Column({nullable: true, default: null})
    slurmId?: string

    @Column({nullable: true, default: null})
    credentialId?: string

    @OneToMany(type => Event, (event: Event) => event.job)
    events: Event[]

    @OneToMany(type => Log, (log: Log) => log.job)
    logs: Log[]

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

    @Column({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    initializedAt: Date

    @Column({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    finishedAt: Date

    @Column({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    queuedAt: Date

    @BeforeInsert()
    async setCreatedAt() {
        this.createdAt = new Date()
    }

    @BeforeUpdate()
    async setUpdatedAt() {
        return this.updatedAt = new Date()
    }

    @Column({default: false})
    isFailed: boolean

    @Column({nullable: true, default: null})
    nodes: number

    @Column({nullable: true, default: null})
    cpus: number

    @Column({nullable: true, default: null})
    cpuTime: number

    @Column({nullable: true, default: null})
    memory: number

    @Column({nullable: true, default: null})
    memoryUsage: number

    @Column({nullable: true, default: null})
    walltime: number

    @AfterLoad()
    sortLogs() {
        if (this.logs) {
            if (this.logs.length) {
                this.logs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1));
            }
        } else {
            this.logs = []
        }
    }

    @AfterLoad()
    sortEvents() {
        if (this.events) {
            if (this.events.length) {
                this.events.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1));
            }
        } else {
            this.events = []
        }
    }

    // runtime properties

    credential?: credential

    maintainerInstance?: BaseMaintainer
}
