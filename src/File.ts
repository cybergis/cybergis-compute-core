import constant from '../src/constant'
import Helper from "./Helper"
import { FileFormatError, FileStructureError} from '../src/errors'

const fs = require('fs')
const path = require("path")
const rimraf = require("rimraf")
const unzipper = require('unzipper')

class File {
    clearTmpFiles() {
        var tmpDir = __dirname + '/data/tmp'
        setInterval(function () {
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
        }, 60 * 60 * 1000)
    }

    async upload(uid, tempFilePath: string,): Promise<string> {
        var fileID = this._generateFileID()
        var zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }))

        const userDir = __dirname + '/../data/upload/' + uid
        const dir = userDir + '/' + fileID
        const dest = constant.destinationMap['summa']

        const clearUpload = () => {
            fs.rmdir(dir, { recursive: true })
        }

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir)
        }

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir)
        }

        var zipContainFiles = {}

        try {
            var tested = false

            for await (const entry of zip) {
                const fileName = entry.path
                const type = entry.type
                const f = fileName.split('/')
                const baseFile = f[1]
                const fileDir = f.slice(1).join('/')

                if ((f.length === 2 && type === 'File') || (f.length === 3 && type === 'Directory')) {
                    if (dest.uploadModelExpectingFolderEntries[baseFile] === type) {
                        zipContainFiles[baseFile] = type
                    }
                } else {
                    if (f.length > 3 && !tested) {
                        for (var i in dest.uploadModelExpectingFolderEntries) {
                            if (zipContainFiles[i] != dest.uploadModelExpectingFolderEntries[i]) {
                                clearUpload()
                                throw new FileFormatError("missing required file [" + i + "] with type [" + dest.uploadModelExpectingFolderEntries[i] + "]")
                            }
                        }
                        tested = true
                    }
                }

                if (dest.uploadModelExpectingFolderEntries[baseFile] != undefined) {
                    if (type === 'File') {
                        entry.pipe(fs.createWriteStream(dir + '/' + fileDir))
                    } else if (type === 'Directory') {
                        if (!fs.existsSync(dir + '/' + fileDir)) {
                            fs.mkdirSync(dir + '/' + fileDir)
                        }
                    }
                } else {
                    entry.autodrain()
                }
            }
        } catch (e) {
            clearUpload()
            throw new FileFormatError("provided file is not a zip file")
        }

        return fileID
    }

    private _generateFileID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }
}

export default File