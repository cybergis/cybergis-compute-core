import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  PrimaryColumn,
} from "typeorm";
  
/** Class representing a user denied from a particular HPC. */
@Entity({ name: "denylist" })
export class DenyList {
  
  @PrimaryGeneratedColumn()
    id!: number;

  @PrimaryColumn()
    user!: string;

  @PrimaryColumn()
    hpc!: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

  @Column({ type: "datetime", nullable: true })
    deletedAt?: Date;


  /**
   *
   */
  @BeforeInsert()
  setCreatedUpdated() {
    this.createdAt = new Date();
  }

  /**
   *
   */
  delete() {
    this.deletedAt = new Date();
  }
}
  