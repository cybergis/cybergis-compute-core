import {
  Entity,
  Column,
  PrimaryColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
  // OneToOne,
} from "typeorm";
// import { Folder } from "./Folder";

@Entity({ name: "gits" })

/** Class representing a git action. */
export class Git {
  @PrimaryColumn()
  public id!: string;

  @Column()
  public address!: string;

  @Column({ nullable: true, default: null })
  public sha!: string;

  @Column({ default: false })
  public isApproved!: boolean;

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
   * @async
   * @return {Date} date - Date this job was created.
   */
  @BeforeInsert()
  public setCreatedAt() {
    this.createdAt = new Date();
  }

  /**
   * Set the updatedAt time to the current time.
   *
   * @async
   * @return {Date} date - Date this job was last updated.
   */
  @BeforeUpdate()
  public setUpdatedAt() {
    return (this.updatedAt = new Date());
  }
}
