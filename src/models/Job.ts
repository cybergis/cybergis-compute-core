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
import BaseMaintainer from "../maintainers/BaseMaintainer";
import {
  credential,
  GitFolder,
  GlobusFolder,
  LocalFolder,
  NeedUploadFolder,
  slurm,
} from "../types";
import { Event } from "./Event";
import { Folder } from "./Folder";
import { Log } from "./Log";

/** Class representing a job. */
@Entity({ name: "jobs" })
export class Job {
  @PrimaryColumn()
    id: string;

  @Column({ nullable: true, default: null })
    userId?: string;

  @Column({ nullable: true, default: null })
    name?: string;

  @Column()
    maintainer: string;

  @Column()
    hpc: string;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
    remoteExecutableFolder: Folder;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
    remoteDataFolder: Folder;

  @ManyToOne((_type) => Folder, { onDelete: "CASCADE", nullable: true })
    remoteResultFolder: Folder;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (
        i: LocalFolder | GitFolder | GlobusFolder | null | undefined
      ): string | null => (i ? JSON.stringify(i) : null),
      from: (
        i: string | null | undefined | object
      ): LocalFolder | GitFolder | GlobusFolder
       | undefined | string | null | object =>
        typeof i === "string" ? JSON.parse(i) as LocalFolder | GitFolder | GlobusFolder : i,
    },
  })
    localExecutableFolder: LocalFolder | GitFolder | GlobusFolder;

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
    localDataFolder: NeedUploadFolder;

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
    param: Record<string, string>;

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
    env: Record<string, string>;

  @Column({
    type: "text",
    nullable: true,
    default: null,
    transformer: {
      to: (i: slurm | null | undefined): string | null =>
        i ? JSON.stringify(i) : null,
      from: (i: string | null | undefined | object): slurm =>
        typeof i === "string" ? JSON.parse(i) as slurm : {},
    },
  })
    slurm?: slurm;

  @Column({ nullable: true, default: null })
    slurmId?: string;

  @Column({ nullable: true, default: null })
    credentialId?: string;

  @OneToMany((_type) => Event, (event: Event) => event.job)
    events: Event[];

  @OneToMany((_type) => Log, (log: Log) => log.job)
    logs: Log[];

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
    createdAt: Date;

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
    updatedAt: Date;

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
    deletedAt: Date;

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
    initializedAt: Date;

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
    finishedAt: Date;

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
    queuedAt: Date;

  /**
   * Set the createdAt time to the current time.
   *
   * @return {Date} date - Date this job was created.
   */
  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }

  /**
   * Set the updatedAt time to the current time.
   *
   * @return {Date} date - Date this job was last updated.
   */
  @BeforeUpdate()
  setUpdatedAt() {
    return (this.updatedAt = new Date());
  }

  @Column({ default: false })
    isFailed: boolean;

  @Column({ nullable: true, default: null })
    nodes: number;

  @Column({ nullable: true, default: null })
    cpus: number;

  @Column({ nullable: true, default: null })
    cpuTime: number;

  @Column({ nullable: true, default: null })
    memory: number;

  @Column({ nullable: true, default: null })
    memoryUsage: number;

  @Column({ nullable: true, default: null })
    walltime: number;

  /**
   * Sorts the logs in the order that they were created
   *
   * @return {None} None - Updates this.logs
   */
  @AfterLoad()
  sortLogs() {
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
  sortEvents() {
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

  credential?: credential;

  maintainerInstance?: BaseMaintainer;
}
