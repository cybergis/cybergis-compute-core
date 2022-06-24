import {Entity, Column, OneToMany, PrimaryColumn, AfterLoad, DeleteDateColumn, BeforeInsert, BeforeUpdate, ManyToOne} from "typeorm"
import {credential, GitFolder, GlobusFolder, LocalFolder, NeedUploadFolder, slurm} from "../types"
import {Event} from "./Event"
import {Log} from "./Log"
import BaseMaintainer from "../maintainers/BaseMaintainer"
import { Folder } from "./Folder"

/** Class representing a job. */
@Entity({name: "jobs"})
export class Job {
    @PrimaryColumn()
    id: string

    @Column({nullable: true, default: null})
    userId?: string

    @Column()
    maintainer: string

    @Column()
    hpc: string

    @ManyToOne(type => Folder, { onDelete: 'CASCADE', nullable: true })
    remoteExecutableFolder: Folder

    @ManyToOne(type => Folder, { onDelete: 'CASCADE', nullable: true })
    remoteDataFolder: Folder

    @ManyToOne(type => Folder, { onDelete: 'CASCADE', nullable: true })
    remoteResultFolder: Folder

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: LocalFolder | GitFolder | GlobusFolder | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined | object): LocalFolder | GitFolder | GlobusFolder => typeof i == 'string' ? JSON.parse(i) : i
    }})
    localExecutableFolder: LocalFolder | GitFolder | GlobusFolder

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: NeedUploadFolder | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined | object): NeedUploadFolder => typeof i == 'string' ? JSON.parse(i) : i
    }})
    localDataFolder: NeedUploadFolder

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: {[keys: string]: string} | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined | object): {[keys: string]: string} => typeof i == 'string' ? JSON.parse(i) : {}
    }})
    param: {[keys: string]: string}

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: {[keys: string]: string} | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined | object): {[keys: string]: string} => typeof i == 'string' ? JSON.parse(i) : {}
    }})
    env: {[keys: string]: string}

    @Column({ type: "text", nullable: true, default: null, transformer: {
        to: (i: slurm | null | undefined): string => i ? JSON.stringify(i) : null,
        from: (i: string | null | undefined | object): slurm => typeof i == 'string' ? JSON.parse(i) : {}
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

    /**
     * Set the createdAt time to the current time.
     * 
     * @async
     * @return {Date} date - Date this job was created.
     */
    @BeforeInsert()
    async setCreatedAt() {
        this.createdAt = new Date()
    }

    /**
     * Set the updatedAt time to the current time.
     * 
     * @async
     * @return {Date} date - Date this job was last updated.
     */
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

    /**
     * Sorts the logs in the order that they were created
     * 
     * @return {None} None - Updates this.logs
     */
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

    /**
     * Sorts the events in the order that they were created
     * 
     * @return {None} None - Updates this.events
     */
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
