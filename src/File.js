"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var constant_1 = require("../src/constant");
var Helper_1 = require("./Helper");
var errors_1 = require("../src/errors");
var fs = require('fs');
var path = require("path");
var rimraf = require("rimraf");
var unzipper = require('unzipper');
var archiver = require('archiver');
var File = (function () {
    function File() {
    }
    File.prototype.clearTmpFiles = function () {
        var tmpDir = __dirname + '/../data/tmp';
        setInterval(function () {
            try {
                fs.readdir(tmpDir, function (err, files) {
                    files.forEach(function (file, index) {
                        if (file != '.gitkeep') {
                            fs.stat(path.join(tmpDir, file), function (err, stat) {
                                var endTime, now;
                                if (err) {
                                    return console.error(err);
                                }
                                now = new Date().getTime();
                                endTime = new Date(stat.ctime).getTime() + 3600000;
                                if (now > endTime) {
                                    return rimraf(path.join(tmpDir, file), function (err) {
                                    });
                                }
                            });
                        }
                    });
                });
            }
            catch (_a) {
            }
        }, 60 * 60 * 1000);
    };
    File.prototype.store = function (uid, destName, tempFilePath) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1, _a, e_2, _b, fileID, userDir, dir, dest, uploadFileConfig, zipContainFiles, zip, zip_1, zip_1_1, entry, fileName, baseFile, e_1_1, i, e_3, zip_2, zip_2_1, entry, filePath, type, f, fileName, baseFile, fileDir, writeFile, createDir, e_2_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        fileID = this._generateFileID();
                        userDir = __dirname + '/../data/upload/' + uid;
                        dir = userDir + '/' + fileID;
                        dest = constant_1.default.destinationMap[destName];
                        uploadFileConfig = {
                            ignore: ['.placeholder', '.DS_Store'],
                            mustHave: [],
                            ignoreEverythingExceptMustHave: false
                        };
                        if (dest.uploadFileConfig.ignore != undefined) {
                            uploadFileConfig.ignore.concat(dest.uploadFileConfig.ignore);
                        }
                        if (dest.uploadFileConfig.mustHave != undefined) {
                            uploadFileConfig.mustHave = dest.uploadFileConfig.mustHave;
                        }
                        if (dest.uploadFileConfig.ignoreEverythingExceptMustHave != undefined) {
                            uploadFileConfig.ignoreEverythingExceptMustHave = dest.uploadFileConfig.ignoreEverythingExceptMustHave;
                        }
                        if (!fs.existsSync(userDir)) {
                            fs.mkdirSync(userDir);
                        }
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir);
                        }
                        zipContainFiles = [];
                        zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }));
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 14, , 15]);
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 7, 8, 13]);
                        zip_1 = __asyncValues(zip);
                        _c.label = 3;
                    case 3: return [4, zip_1.next()];
                    case 4:
                        if (!(zip_1_1 = _c.sent(), !zip_1_1.done)) return [3, 6];
                        entry = zip_1_1.value;
                        entry.autodrain();
                        fileName = entry.path;
                        baseFile = fileName.split('/')[1];
                        if (uploadFileConfig.mustHave.includes(baseFile)) {
                            zipContainFiles.push(baseFile);
                        }
                        _c.label = 5;
                    case 5: return [3, 3];
                    case 6: return [3, 13];
                    case 7:
                        e_1_1 = _c.sent();
                        e_1 = { error: e_1_1 };
                        return [3, 13];
                    case 8:
                        _c.trys.push([8, , 11, 12]);
                        if (!(zip_1_1 && !zip_1_1.done && (_a = zip_1.return))) return [3, 10];
                        return [4, _a.call(zip_1)];
                    case 9:
                        _c.sent();
                        _c.label = 10;
                    case 10: return [3, 12];
                    case 11:
                        if (e_1) throw e_1.error;
                        return [7];
                    case 12: return [7];
                    case 13:
                        for (i in uploadFileConfig.mustHave) {
                            if (!zipContainFiles.includes(uploadFileConfig.mustHave[i])) {
                                throw new errors_1.FileStructureError("missing required base file/folder [" + uploadFileConfig.mustHave[i] + "]");
                            }
                        }
                        return [3, 15];
                    case 14:
                        e_3 = _c.sent();
                        if (e_3.name === 'FileStructureError') {
                            throw e_3;
                        }
                        throw new errors_1.FileFormatError("provided file is not a zip file");
                    case 15:
                        zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }));
                        _c.label = 16;
                    case 16:
                        _c.trys.push([16, 21, 22, 27]);
                        zip_2 = __asyncValues(zip);
                        _c.label = 17;
                    case 17: return [4, zip_2.next()];
                    case 18:
                        if (!(zip_2_1 = _c.sent(), !zip_2_1.done)) return [3, 20];
                        entry = zip_2_1.value;
                        filePath = entry.path;
                        type = entry.type;
                        f = filePath.split('/');
                        fileName = f.pop();
                        baseFile = f[1];
                        fileDir = f.slice(1).join('/');
                        writeFile = function () {
                            if (type === 'File' && !uploadFileConfig.ignore.includes(fileName)) {
                                entry.pipe(fs.createWriteStream(dir + '/' + fileDir + '/' + fileName));
                            }
                        };
                        createDir = function () {
                            if (!fs.existsSync(dir + '/' + fileDir)) {
                                fs.promises.mkdir(dir + '/' + fileDir, { recursive: true });
                            }
                        };
                        if (baseFile != undefined) {
                            if (uploadFileConfig.ignoreEverythingExceptMustHave) {
                                if (uploadFileConfig.mustHave.includes(baseFile)) {
                                    createDir();
                                    writeFile();
                                }
                                else {
                                    entry.autodrain();
                                }
                            }
                            else {
                                createDir();
                                writeFile();
                            }
                        }
                        else {
                            if (uploadFileConfig.ignoreEverythingExceptMustHave) {
                                if (uploadFileConfig.mustHave.includes(fileName)) {
                                    writeFile();
                                }
                                else {
                                    entry.autodrain();
                                }
                            }
                            else {
                                writeFile();
                            }
                        }
                        _c.label = 19;
                    case 19: return [3, 17];
                    case 20: return [3, 27];
                    case 21:
                        e_2_1 = _c.sent();
                        e_2 = { error: e_2_1 };
                        return [3, 27];
                    case 22:
                        _c.trys.push([22, , 25, 26]);
                        if (!(zip_2_1 && !zip_2_1.done && (_b = zip_2.return))) return [3, 24];
                        return [4, _b.call(zip_2)];
                    case 23:
                        _c.sent();
                        _c.label = 24;
                    case 24: return [3, 26];
                    case 25:
                        if (e_2) throw e_2.error;
                        return [7];
                    case 26: return [7];
                    case 27: return [2, fileID];
                }
            });
        });
    };
    File.prototype.zip = function (uid, fileID) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceDir, output, archive;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourceDir = __dirname + '/../data/upload/' + uid + '/' + fileID;
                        if (!fs.existsSync(sourceDir) || uid == '' || fileID == '') {
                            throw new Error('zip source directory not found');
                        }
                        if (fs.existsSync(sourceDir + '.zip')) {
                            return [2, sourceDir + '.zip'];
                        }
                        output = fs.createWriteStream(sourceDir + '.zip');
                        archive = archiver('zip', {
                            zlib: { level: 9 }
                        });
                        return [4, new Promise(function (resolve, reject) {
                                archive.pipe(output);
                                archive.directory(sourceDir, false);
                                archive.finalize();
                                output.on('close', function () {
                                    resolve('');
                                });
                            })];
                    case 1:
                        _a.sent();
                        return [2, sourceDir + '.zip'];
                }
            });
        });
    };
    File.prototype._generateFileID = function () {
        return Math.round((new Date()).getTime() / 1000) + Helper_1.default.randomStr(4);
    };
    return File;
}());
exports.default = File;
