import {Entity, Column, PrimaryColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate} from "typeorm"

/** Class representing a job event. */
@Entity({name: "folders"})
export class Folder {
    @PrimaryColumn()
    id: string

    @Column()
    path: string

    @Column()
    hpc: string

    @Column({ nullable: true })
    userId: string

    @Column({type: 'bigint', transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    createdAt: Date

    @Column({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    updatedAt: Date

    @DeleteDateColumn({type: 'bigint', nullable: true, transformer: {
        to: (i: Date | null | undefined): number => i ? i.getTime() : null,
        from: (i: number | null | undefined): Date => i ? new Date(i) : null
    }})
    deletedAt: Date

        /**
     * Set the createdAt time to the current time.
     * 
     * @async
     * @return {Date} date - Date this job was created.
     */
    @BeforeInsert()
    async setCreatedAt() {
        this.createdAt = new Date()
    }

    /**
     * Set the updatedAt time to the current time.
     * 
     * @async
     * @return {Date} date - Date this job was last updated.
     */
    @BeforeUpdate()
    async setUpdatedAt() {
        return this.updatedAt = new Date()
    }
}