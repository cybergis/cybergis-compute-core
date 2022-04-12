import { Entity, Column, PrimaryColumn, DeleteDateColumn, BeforeInsert, BeforeUpdate } from "typeorm"

@Entity({name: "gits"})
export class Git {
    @PrimaryColumn()
    id: string

    @Column()
    address: string

    @Column({nullable: true, default: null})
    sha: string

    @Column({default: false})
    isApproved: boolean

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

    @BeforeInsert()
    async setCreatedAt() {
        this.createdAt = new Date()
    }

    @BeforeUpdate()
    async setUpdatedAt() {
        return this.updatedAt = new Date()
    }
}
