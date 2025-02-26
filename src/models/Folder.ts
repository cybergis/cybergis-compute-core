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
  public id!: string;

  @Column({ nullable: true })
  public name?: string;

  @Column()
  public hpc!: string;

  @Column()
  public hpcPath!: string;

  @Column()
  public globusPath!: string;

  @Column({ nullable: true })
  public userId?: string;

  @Column({ default: false })
  public isWritable!: boolean;

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
}
