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
var File = (function () {
    function File() {
    }
    File.prototype.clearTmpFiles = function () {
        var tmpDir = __dirname + '/data/tmp';
        setInterval(function () {
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
        }, 60 * 60 * 1000);
    };
    File.prototype.upload = function (uid, tempFilePath) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1, _a, fileID, zip, userDir, dir, dest, clearUpload, zipContainFiles, tested, zip_1, zip_1_1, entry, fileName, type, f, baseFile, fileDir, i, e_1_1, e_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        fileID = this._generateFileID();
                        zip = fs.createReadStream(tempFilePath).pipe(unzipper.Parse({ forceStream: true }));
                        userDir = __dirname + '/../data/upload/' + uid;
                        dir = userDir + '/' + fileID;
                        dest = constant_1.default.destinationMap['summa'];
                        clearUpload = function () {
                            fs.rmdir(dir, { recursive: true });
                        };
                        if (!fs.existsSync(userDir)) {
                            fs.mkdirSync(userDir);
                        }
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir);
                        }
                        zipContainFiles = {};
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 14, , 15]);
                        tested = false;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 7, 8, 13]);
                        zip_1 = __asyncValues(zip);
                        _b.label = 3;
                    case 3: return [4, zip_1.next()];
                    case 4:
                        if (!(zip_1_1 = _b.sent(), !zip_1_1.done)) return [3, 6];
                        entry = zip_1_1.value;
                        fileName = entry.path;
                        type = entry.type;
                        f = fileName.split('/');
                        baseFile = f[1];
                        fileDir = f.slice(1).join('/');
                        if ((f.length === 2 && type === 'File') || (f.length === 3 && type === 'Directory')) {
                            if (dest.uploadModelExpectingFolderEntries[baseFile] === type) {
                                zipContainFiles[baseFile] = type;
                            }
                        }
                        else {
                            if (f.length > 3 && !tested) {
                                for (i in dest.uploadModelExpectingFolderEntries) {
                                    if (zipContainFiles[i] != dest.uploadModelExpectingFolderEntries[i]) {
                                        clearUpload();
                                        throw new errors_1.FileFormatError("missing required file [" + i + "] with type [" + dest.uploadModelExpectingFolderEntries[i] + "]");
                                    }
                                }
                                tested = true;
                            }
                        }
                        if (dest.uploadModelExpectingFolderEntries[baseFile] != undefined) {
                            if (type === 'File') {
                                entry.pipe(fs.createWriteStream(dir + '/' + fileDir));
                            }
                            else if (type === 'Directory') {
                                if (!fs.existsSync(dir + '/' + fileDir)) {
                                    fs.mkdirSync(dir + '/' + fileDir);
                                }
                            }
                        }
                        else {
                            entry.autodrain();
                        }
                        _b.label = 5;
                    case 5: return [3, 3];
                    case 6: return [3, 13];
                    case 7:
                        e_1_1 = _b.sent();
                        e_1 = { error: e_1_1 };
                        return [3, 13];
                    case 8:
                        _b.trys.push([8, , 11, 12]);
                        if (!(zip_1_1 && !zip_1_1.done && (_a = zip_1.return))) return [3, 10];
                        return [4, _a.call(zip_1)];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10: return [3, 12];
                    case 11:
                        if (e_1) throw e_1.error;
                        return [7];
                    case 12: return [7];
                    case 13: return [3, 15];
                    case 14:
                        e_2 = _b.sent();
                        clearUpload();
                        throw new errors_1.FileFormatError("provided file is not a zip file");
                    case 15: return [2, fileID];
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
