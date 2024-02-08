import {
  Entity,
  Column,
  // OneToMany,
  PrimaryColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";

/** Class representing a globus transfer refresh token. */
@Entity({ name: "globus_transfer_refresh_token" })
export class GlobusTransferRefreshToken {
  @PrimaryColumn()
    identity: string;

  @Column()
    transferRefreshToken: string;

  @Column({
    type: "bigint",
    transformer: {
      to: (i: Date | null | undefined): number => (i ? i.getTime() : null),
      from: (i: number | null | undefined): Date => (i ? new Date(Math.trunc(i)) : null),
    },
  })
    createdAt: Date;

  @Column({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (i: Date | null | undefined): number => (i ? i.getTime() : null),
      from: (i: number | null | undefined): Date => (i ? new Date(Math.trunc(i)) : null),
    },
  })
    updatedAt: Date;

  @DeleteDateColumn({
    type: "bigint",
    nullable: true,
    transformer: {
      to: (i: Date | null | undefined): number => (i ? i.getTime() : null),
      from: (i: number | null | undefined): Date => (i ? new Date(Math.trunc(i)) : null),
    },
  })
    deletedAt: Date;

  /**
   * Set the createdAt time to the current time.
   *
   * @async
   * @return {Date} date - Date this job was created.
   */
  @BeforeInsert()
  async setCreatedAt() {
    this.createdAt = new Date();
  }

  /**
   * Set the updatedAt time to the current time.
   *
   * @async
   * @return {Date} date - Date this job was last updated.
   */
  @BeforeUpdate()
  async setUpdatedAt() {
    return (this.updatedAt = new Date());
  }
}
