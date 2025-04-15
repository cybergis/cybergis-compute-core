import {
  Entity,
  Column,
  PrimaryColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
  // OneToOne,
} from "typeorm";

/**
 * Calss represnting a git repository. 
 */
@Entity({ name: "gits" })
export class Git {
  @PrimaryColumn()
    id!: string;

  @Column()
    address!: string;

  @Column({ nullable: true, default: null })
    sha!: string;

  @Column({ default: false })
    isApproved!: boolean;

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
    createdAt!: Date;

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
    updatedAt?: Date;

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
    deletedAt?: Date;

  /**
   * Set the createdAt time to the current time.
   */
  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }

  /**
   * Set the updatedAt time to the current time.
   * @returns date - Date this job was last updated.
   */
  @BeforeUpdate()
  setUpdatedAt() {
    return (this.updatedAt = new Date());
  }
}
