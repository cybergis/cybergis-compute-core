import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
} from "typeorm";
    
/** Class representing a pending allow/deny approval. */
@Entity({ name: "user_info" })
export class UserInfo {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column()
    user!: string;

  @Column()
    access_eppn!: string;

  @Column()
    email!: string;

  @Column()
    name!: string;

  @Column()
    nbf?: number;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;
    

  /**
   *
   */
  @BeforeInsert()
  setCreatedUpdated() {
    this.createdAt = new Date();
  }
}
    