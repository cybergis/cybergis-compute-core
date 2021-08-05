import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity({name: "gits"})
export class Git {
    @PrimaryColumn()
    address: string

    @Column({nullable: true, default: null})
    sha: string

    @Column({default: false})
    isApproved: boolean
}
