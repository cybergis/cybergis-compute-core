import { Entity, Column, PrimaryColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate, OneToOne } from "typeorm"
import { Folder } from "./Folder"

@Entity({name: "gits"})

/** Class representing a git action. */
export class Git {
    @PrimaryColumn()
    id: string

    @Column()
    address: string

    @Column({nullable: true, default: null})
    sha: string

    @Column({default: false})
    isApproved: boolean

    @OneToOne(type => Folder, { nullable: null })
    folder: Folder

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
