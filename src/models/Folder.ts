import {
  Entity,
  Column,
  PrimaryColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
  // OneToMany,
} from "typeorm";
// import { Job } from "./Job";

/** Class representing a job event. */
@Entity({ name: "folders" })
export class Folder {
  @PrimaryColumn()
    id: string;

  @Column({ nullable: true })
    name: string;

  @Column()
    hpc: string;

  @Column()
    hpcPath: string;

  @Column()
    globusPath: string;

  @Column({ nullable: true })
    userId: string;

  @Column({ default: false })
    isWritable: boolean;

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
}
