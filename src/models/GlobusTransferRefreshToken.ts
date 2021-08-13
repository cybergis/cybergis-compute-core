import {Entity, Column, OneToMany, PrimaryColumn, AfterLoad} from "typeorm"

@Entity({name: "globus_transfer_refresh_token"})
export class GlobusTransferRefreshToken {
    @PrimaryColumn()
    identity: string

    @Column()
    transferRefreshToken: string

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    createdAt: Date

    @Column({type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    updatedAt: Date

    @Column({type: 'timestamp', default: null})
    deletedAt: Date
}
