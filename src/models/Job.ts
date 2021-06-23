import {Entity, Column, OneToMany, PrimaryColumn, AfterLoad} from "typeorm"
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

    @Column({nullable: true, default: null})
    executableFolder: string

    @Column({nullable: true, default: null})
    dataFolder: string

    @Column({nullable: true, default: null})
    resultFolder: string

    @Column({type: 'simple-json'})
    param: {[keys: string]: string}

    @Column({type: 'simple-json'})
    env: {[keys: string]: string}

    @Column({type: 'simple-json', nullable: true})
    slurm?: slurm

    @Column({nullable: true, default: null})
    credentialId?: string

    @OneToMany(type => Event, (event: Event) => event.job)
    events: Event[]

    @OneToMany(type => Log, (log: Log) => log.job)
    logs: Log[]

    @Column({type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP'})
    createdAt: Date

    @Column({type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP'})
    updatedAt: Date

    @Column({type: 'timestamp', nullable: true, default: null})
    deletedAt: Date

    @Column({type: 'timestamp', nullable: true, default: null})
    initializedAt: Date

    @Column({type: 'timestamp', nullable: true, default: null})
    finishedAt: Date

    @Column({default: false})
    isFailed: boolean

    @AfterLoad()
    sortLogs() {
        if (this.events) {
            if (this.logs.length) {
                this.logs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1));
            }
        }
    }

    @AfterLoad()
    sortEvents() {
        if (this.events) {
            if (this.events.length) {
                this.events.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1));
            }
        }
    }

    // runtime properties

    credential?: credential

    maintainerInstance?: BaseMaintainer
}
