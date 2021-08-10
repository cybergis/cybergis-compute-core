import {Entity, Column, OneToMany, PrimaryColumn, AfterLoad} from "typeorm"
import {slurm} from "../types"
import {Event} from "./Event"
import {Log} from "./Log"

@Entity({name: "globus"})
export class Globus {
    @PrimaryColumn()
    id: string
}
