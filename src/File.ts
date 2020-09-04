import constant from '../src/constant'
import Helper from "./Helper"
import { FileFormatError, FileStructureError} from '../src/errors'

const fs = require('fs')
const path = require("path")
const rimraf = require("rimraf")
const unzipper = require('unzipper')
const archiver = require('archiver')

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

    async store(uid, destName: string, tempFilePath: string,): Promise<string> {
        var fileID = this._generateFileID()

        const userDir = __dirname + '/../data/upload/' + uid
        const dir = userDir + '/' + fileID
        const dest = constant.destinationMap[destName]
        const uploadFileConfig = {
            ignore: ['.placeholder', '.DS_Store'],
            mustHave: [],
            ignoreEverythingExceptMustHave: false
        }

        if (dest.uploadFileConfig.ignore != undefined) {
            uploadFileConfig.ignore.concat(dest.uploadFileConfig.ignore)
        }

        if (dest.uploadFileConfig.mustHave != undefined) {
            uploadFileConfig.mustHave = dest.uploadFileConfig.mustHave
        }

        if (dest.uploadFileConfig.ignoreEverythingExceptMustHave != undefined) {
            uploadFileConfig.ignoreEverythingExceptMustHave = dest.uploadFileConfig.ignoreEverythingExceptMustHave
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
                if (uploadFileConfig.mustHave.includes(baseFile)) {
                    zipContainFiles.push(baseFile)
                }
            }

            for (var i in uploadFileConfig.mustHave) {
                if (!zipContainFiles.includes(uploadFileConfig.mustHave[i])) {
                    throw new FileStructureError("missing required base file/folder [" + uploadFileConfig.mustHave[i] + "]")
                }
            }
        } catch (e) {
            if (e.name === 'FileStructureError') {
                throw e
            }
            throw new FileFormatError("provided file is not a zip file")
        }

        zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }))

        for await (const entry of zip) {
            const filePath = entry.path
            const type = entry.type
            const f = filePath.split('/')
            const fileName = f.pop()
            const baseFile = f[1]
            const fileDir = f.slice(1).join('/')

            const writeFile = function () {
                if (type === 'File' && !uploadFileConfig.ignore.includes(fileName)) {
                    entry.pipe(fs.createWriteStream(dir + '/' + fileDir + '/' + fileName))
                }
            }

            const createDir = function () {
                if (!fs.existsSync(dir + '/' + fileDir)) {
                    fs.promises.mkdir(dir + '/' + fileDir, { recursive: true })
                }
            }

            if (baseFile != undefined) {
                if (uploadFileConfig.ignoreEverythingExceptMustHave) {
                    if (uploadFileConfig.mustHave.includes(baseFile)) {
                        createDir()
                        writeFile()
                    } else {
                        entry.autodrain()
                    }
                } else {
                    createDir()
                    writeFile()
                }
            } else {
                if (uploadFileConfig.ignoreEverythingExceptMustHave) {
                    if (uploadFileConfig.mustHave.includes(fileName)) {
                        writeFile()
                    } else {
                        entry.autodrain()
                    }
                } else {
                    writeFile()
                }
            }
        }

        return fileID
    }

    async zip(uid, fileID: string): Promise<string> {
        const sourceDir = __dirname + '/../data/upload/' + uid + '/' + fileID

        if (!fs.existsSync(sourceDir) || uid == '' || fileID == '') {
            throw new Error('zip source directory not found')
        }

        if (fs.existsSync(sourceDir + '.zip')) {
            return sourceDir + '.zip'
        }

        var output = fs.createWriteStream(sourceDir + '.zip')
        var archive = archiver('zip', {
            zlib: { level: 9 }
        })
        await new Promise((resolve, reject) => {
            archive.pipe(output)
            archive.directory(sourceDir, false)
            archive.finalize()
            output.on('close', function () {
                resolve('')
            })
        })

        return sourceDir + '.zip'
    }

    private _generateFileID(): string {
        return Math.round((new Date()).getTime() / 1000) + Helper.randomStr(4)
    }
}

export default File