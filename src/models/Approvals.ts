import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
} from "typeorm";
    
/** Class representing a pending allow/deny approval. */
@Entity({ name: "approvals" })
export class Approvals {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column()
    user!: string;

  @Column()
    hpc!: string;

  @Column()
    type!: string;

  @Column()
    hash!: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

  @Column({ 
    type: "datetime",
    nullable: true
  })
    approvedAt?: Date;

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
  approve() {
    this.approvedAt = new Date();
  }
}
    