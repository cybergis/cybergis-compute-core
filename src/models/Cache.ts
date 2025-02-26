import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  PrimaryColumn,
} from "typeorm";
  
/** Class representing a cached entity. */
@Entity({ name: "caches" })
export class Cache {
  @PrimaryGeneratedColumn()
  public id!: number;

  @PrimaryColumn()
  public hpc!: string;
  
  // can either store the local uploadfolder or the remote hpcPath
  // just need some way to match uploaded cache files to local ones
  // currently do the remote hpcPath since it is simpler but switching to local may be more robust
  // since it is singular
  // @Column("json")
  //   folder!: NeedUploadFolder;
    
  @PrimaryColumn()
  public hpcPath!: string;
  
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
    transformer: {
      to: (
        i: Date | null | undefined
      ): number | null => (i ? i.getTime() : null),
      from: (
        i: number | null | undefined
      ): Date | null => (i ? new Date(Math.trunc(i)) : null),
    },
  })
  public updatedAt!: Date;
  
  /**
   * Set the createdAt time to the current time.
   *
   * @return {Date} date - Date this job was created.
   */
  @BeforeInsert()
  public setCreatedUpdated() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public update() {
    this.createdAt = new Date();
  }
}
  