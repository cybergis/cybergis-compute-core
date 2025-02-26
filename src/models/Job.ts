import {
  Entity,
  Column,
  OneToMany,
  PrimaryColumn,
  AfterLoad,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  // JoinColumn,
} from "typeorm";

import {
  credential,
  GitFolder,
  GlobusFolder,
  LocalFolder,
  NeedUploadFolder,
  slurm,
} from "../definitions";
import BaseMaintainer from "../maintainers/BaseMaintainer";

import { Event } from "./Event";
import { Folder } from "./Folder";
import { Log } from "./Log";

/** Class representing a job. */
@Entity({ name: "jobs" })
export class Job {
  @PrimaryColumn()
  public id!: string;

  @Column({ nullable: true })
  public userId?: string;

  @Column({ nullable: true })
  public name?: string;

  @Column()
  public maintainer!: string;

  @Column()
  public hpc!: string;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
  public remoteExecutableFolder?: Folder;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
  public remoteDataFolder?: Folder;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
  public remoteResultFolder?: Folder;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (
        i: NeedUploadFolder | null | undefined
      ): string | null => (i ? JSON.stringify(i) : null),
      from: (
        i: string | null | undefined | object
      ): LocalFolder | GitFolder | GlobusFolder
       | undefined | string | null | object =>
        typeof i === "string" ? JSON.parse(i) as NeedUploadFolder : i,
    },
  })
  public localExecutableFolder?: NeedUploadFolder;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (i: NeedUploadFolder | null | undefined): string | null =>
        i ? JSON.stringify(i) : null,
      from: (
        i: string | null | undefined | object
      ): NeedUploadFolder | string | null | undefined | object =>
        typeof i === "string" ? JSON.parse(i) as NeedUploadFolder : i,
    },
  })
  public localDataFolder?: NeedUploadFolder;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (i: Record<string, string> | null | undefined): string | null =>
        i ? JSON.stringify(i) : null,
      from: (
        i: string | null | undefined | object
      ): Record<string, string> =>
        typeof i === "string" ? JSON.parse(i) as Record<string, string> : {},
    },
  })
  public param?: Record<string, string>;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (i: Record<string, string> | null | undefined): string | null =>
        i ? JSON.stringify(i) : null,
      from: (
        i: string | null | undefined | object
      ): Record<string, string> =>
        typeof i === "string" ? JSON.parse(i) as Record<string, string> : {},
    },
  })
  public env?: Record<string, string>;

  @Column({
    type: "text",
    nullable: true,
    transformer: {
      to: (i: slurm | null | undefined): string | null =>
        i ? JSON.stringify(i) : null,
      from: (i: string | null | undefined | object): slurm =>
        typeof i === "string" ? JSON.parse(i) as slurm : {},
    },
  })
  public slurm?: slurm;

  @Column({ nullable: true })
  public slurmId?: string;

  @Column({ nullable: true })
  public credentialId?: string;

  @OneToMany((_type) => Event, (event: Event) => event.job)
  public events!: Event[];

  @OneToMany((_type) => Log, (log: Log) => log.job)
  public logs!: Log[];

  @Column({
    type: "bigint",
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public createdAt!: Date;

  @Column({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public updatedAt?: Date;

  @DeleteDateColumn({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public deletedAt?: Date;

  @Column({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null=> (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public initializedAt?: Date;

  @Column({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public finishedAt?: Date;

  @Column({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public queuedAt!: Date;

  /**
   * Set the createdAt time to the current time.
   *
   * @return {Date} date - Date this job was created.
   */
  @BeforeInsert()
  public setCreatedAt() {
    this.createdAt = new Date();
  }

  /**
   * Set the updatedAt time to the current time.
   *
   * @return {Date} date - Date this job was last updated.
   */
  @BeforeUpdate()
  public setUpdatedAt() {
    return (this.updatedAt = new Date());
  }

  @Column({ default: false })
  public isFailed!: boolean;

  @Column({ nullable: true })
  public nodes?: number;

  @Column({ nullable: true })
  public cpus?: number;

  @Column({ nullable: true })
  public cpuTime?: number;

  @Column({ nullable: true })
  public memory?: number;

  @Column({ nullable: true })
  public memoryUsage?: number;

  @Column({ nullable: true })
  public walltime?: number;

  /**
   * Sorts the logs in the order that they were created
   *
   * @return {None} None - Updates this.logs
   */
  @AfterLoad()
  public sortLogs() {
    if (this.logs) {
      if (this.logs.length) {
        this.logs.sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1
        );
      }
    } else {
      this.logs = [];
    }
  }

  /**
   * Sorts the events in the order that they were created
   *
   * @return {None} None - Updates this.events
   */
  @AfterLoad()
  public sortEvents() {
    if (this.events) {
      if (this.events.length) {
        this.events.sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt === b.createdAt ? 0 : 1
        );
      }
    } else {
      this.events = [];
    }
  }

  // runtime properties

  public credential?: credential;

  public maintainerInstance?: BaseMaintainer;
}
