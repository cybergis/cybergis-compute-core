import constant from '../src/constant'
import Helper from "./Helper"
import { FileFormatError, FileStructureError} from '../src/errors'

const fs = require('fs')
const path = require("path")
const rimraf = require("rimraf")
const unzipper = require('unzipper')

class File {
    clearTmpFiles() {
        var tmpDir = __dirname + '/../data/tmp'
        setInterval(function () {
            try {
                fs.readdir(tmpDir, function (err, files) {
                    files.forEach(function (file, index) {
                        if (file != '.gitkeep') {
                            fs.stat(path.join(tmpDir, file), function (err, stat) {
                                var endTime, now;
                                if (err) {
                                    return console.error(err)
                                }
                                now = new Date().getTime()
                                endTime = new Date(stat.ctime).getTime() + 3600000
                                if (now > endTime) {
                                    return rimraf(path.join(tmpDir, file), function (err) {
                                        //
                                    })
                                }
                            })
                        }
                    })
                })
            } catch {
                //
            }
        }, 60 * 60 * 1000)
    }

    async upload(uid, tempFilePath: string,): Promise<string> {
        var fileID = this._generateFileID()

        const userDir = __dirname + '/../data/upload/' + uid
        const dir = userDir + '/' + fileID
        const dest = constant.destinationMap['summa']

        const clearUpload = () => {
            // fs.rmdir(dir, { recursive: true })
        }

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir)
        }

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir)
        }

        var zipContainFiles = []

        var zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }))

        try {
            for await (const entry of zip) {
                entry.autodrain()
                const fileName = entry.path
                const baseFile = fileName.split('/')[1]
                if (dest.uploadModelExpectingBaseStructure.includes(baseFile)) {
                    zipContainFiles.push(baseFile)
                }
            }

            for (var i in dest.uploadModelExpectingBaseStructure) {
                if (!zipContainFiles.includes(dest.uploadModelExpectingBaseStructure[i])) {
                    throw new FileStructureError("missing required base file/folder [" + dest.uploadModelExpectingBaseStructure[i] + "]")
                }
            }
        } catch (e) {
            if (e.name === 'FileStructureError') {
                throw e
            }
            clearUpload()
            throw new FileFormatError("provided file is not a zip file")
        }

        zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }))

        const ignoreFiles = ['.placeholder', '.DS_Store']

        for await (const entry of zip) {
            const filePath = entry.path
            const type = entry.type
            const f = filePath.split('/')
            const fileName = f.pop()
            const baseFile = f[1]
            const fileDir = f.slice(1).join('/')

            if (baseFile != undefined) {
                if (dest.uploadModelExpectingBaseStructure.includes(baseFile)) {
                    if (!fs.existsSync(dir + '/' + fileDir)) {
                        fs.promises.mkdir(dir + '/' + fileDir, { recursive: true })
                    }

                    if (type === 'File' && !ignoreFiles.includes(fileName)) {
                        entry.pipe(fs.createWriteStream(dir + '/' + fileDir + '/' + fileName))
                    }
                } else {
                    entry.autodrain()
                }
            } else {
                if (dest.uploadModelExpectingBaseStructure.includes(fileName)) {
                    if (type === 'File' && !ignoreFiles.includes(fileName)) {
                        entry.pipe(fs.createWriteStream(dir + '/' + fileName))
                    }
                }
            }
    }

        return fileID
    }

    private _generateFileID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }
}

export default File