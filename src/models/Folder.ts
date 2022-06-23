import {Entity, Column, PrimaryColumn, DeleteDateColumn} from "typeorm"

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
}