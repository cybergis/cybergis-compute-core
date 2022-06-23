import * as fs from "fs"
import { spawn } from "child_process"
import { FileNotExistError } from "../errors"
import * as path from 'path'

export default class registerUtil {
    static async isZipped(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath + '.zip', fs.constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    static async getZip(filePath: string): Promise<string> {
        if (!filePath) throw new Error('getZip operation is not supported')
        if (await this.isZipped(filePath)) return filePath + '.zip'

        try {
            const child = spawn(`zip`, ['-q', '-r', `${filePath}.zip`, '.', `${path.basename(filePath)}`], { cwd: filePath })
            return new Promise((resolve, reject) => {
                child.on('exit', () => resolve(`${filePath}.zip`))
                child.on('close', () => resolve(`${filePath}.zip`))
                child.on('error', () => reject(`${filePath}.zip`))
            })
        } catch (e) {
            throw new Error(e)
        }
    }

    static async removeZip(filePath: string) {
        if (await this.isZipped(filePath)) {
            await fs.promises.unlink(filePath + '.zip')
        }
    }

    static async removeFolder(filePath) {
        if (await this.exists(filePath)) {
            fs.rmdirSync(filePath, { recursive: true })
        }
    }

    static async exists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK)
            return true
        } catch {
            return false
        }
    }

    static async putFileFromZip(filePath: string, zipFilePath: string) {
        if (!await this.exists(filePath)) {
            throw new FileNotExistError('file not exists or initialized')
        }

        try {
            const child = spawn(`unzip`, ['-o', '-q', `${zipFilePath}`, '-d', `${filePath}`])
            return new Promise((resolve, reject) => {
                child.on('exit', () => resolve(`${filePath}.zip`))
                child.on('close', () => resolve(`${filePath}.zip`))
                child.on('error', () => reject(`${filePath}.zip`))
            })
        } catch (e) {
            throw new Error(e)
        }
    }
}