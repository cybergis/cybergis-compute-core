"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
Object.defineProperty(exports, "__esModule", { value: true });
var Queue_1 = require("./Queue");
var Emitter_1 = require("./Emitter");
var Helper_1 = require("./Helper");
var constant_1 = require("./constant");
var fs = require('fs');
var archiver = require('archiver');
var Supervisor = (function () {
    function Supervisor() {
        this.jobPoolCapacities = {};
        this.jobPools = {};
        this.downloadPools = {};
        this.queues = {};
        this.emitter = new Emitter_1.default();
        this.maintainerThread = null;
        this.workerTimePeriodInSeconds = 10;
        var self = this;
        for (var service in constant_1.default.destinationMap) {
            var destination = constant_1.default.destinationMap[service];
            this.jobPoolCapacities[service] = destination.jobPoolCapacity;
            this.jobPools[service] = [];
            this.queues[service] = new Queue_1.default(service);
        }
        this.maintainerThread = setInterval(function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _i, service, jobPool, i, job, jobThrowError, _c, _d, events, logs, j, event, j, _e, job, maintainer;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _a = [];
                            for (_b in self.jobPools)
                                _a.push(_b);
                            _i = 0;
                            _f.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3, 17];
                            service = _a[_i];
                            jobPool = self.jobPools[service];
                            if (!(jobPool.length > 0)) return [3, 12];
                            i = 0;
                            _f.label = 2;
                        case 2:
                            if (!(i < jobPool.length)) return [3, 12];
                            job = jobPool[i];
                            jobThrowError = false;
                            if (!job.maintainer.isInit) return [3, 7];
                            _f.label = 3;
                        case 3:
                            _f.trys.push([3, 5, , 6]);
                            return [4, job.maintainer.maintain()];
                        case 4:
                            _f.sent();
                            return [3, 6];
                        case 5:
                            _c = _f.sent();
                            jobThrowError = true;
                            return [3, 6];
                        case 6: return [3, 10];
                        case 7:
                            _f.trys.push([7, 9, , 10]);
                            return [4, job.maintainer.init()];
                        case 8:
                            _f.sent();
                            return [3, 10];
                        case 9:
                            _d = _f.sent();
                            jobThrowError = true;
                            return [3, 10];
                        case 10:
                            events = job.maintainer.dumpEvents();
                            logs = job.maintainer.dumpLogs();
                            for (j in events) {
                                event = events[j];
                                self.emitter.registerEvents(job.uid, job.maintainer.getJobID(), event.type, event.message);
                            }
                            for (j in logs) {
                                self.emitter.registerLogs(job.uid, job.maintainer.getJobID(), logs[j]);
                            }
                            if (job.maintainer.isEnd || jobThrowError) {
                                jobPool.splice(i, 1);
                                if (job.maintainer.downloadedPath != undefined) {
                                    self.downloadPools[job.maintainer.getJobID()] = job.maintainer.downloadedPath;
                                }
                                i--;
                            }
                            _f.label = 11;
                        case 11:
                            i++;
                            return [3, 2];
                        case 12:
                            _e = jobPool.length < self.jobPoolCapacities[service];
                            if (!_e) return [3, 14];
                            return [4, self.queues[service].isEmpty()];
                        case 13:
                            _e = !(_f.sent());
                            _f.label = 14;
                        case 14:
                            if (!_e) return [3, 16];
                            return [4, self.queues[service].shift()];
                        case 15:
                            job = _f.sent();
                            maintainer = require('./maintainers/' + constant_1.default.destinationMap[job.dest].maintainer).default;
                            job.maintainer = new maintainer(job);
                            jobPool.push(job);
                            self.emitter.registerEvents(job.uid, job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization');
                            return [3, 12];
                        case 16:
                            _i++;
                            return [3, 1];
                        case 17: return [2];
                    }
                });
            });
        }, this.workerTimePeriodInSeconds * 1000);
    }
    Supervisor.prototype.add = function (manifest) {
        return __awaiter(this, void 0, void 0, function () {
            var dest;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dest = constant_1.default.destinationMap[manifest.dest];
                        if (dest.useUploadedFile) {
                            if (manifest.file != undefined) {
                                if (!fs.existsSync(__dirname + '/../data/upload/' + manifest.uid + '/' + manifest.file)) {
                                    throw new Error('file [' + manifest.file + '] not exists');
                                }
                            }
                            else {
                                throw new Error('no file provided');
                            }
                        }
                        manifest.id = this._generateJobID();
                        return [4, this.queues[manifest.dest].push(manifest)];
                    case 1:
                        _a.sent();
                        this.emitter.registerEvents(manifest.uid, manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration');
                        return [2, manifest];
                }
            });
        });
    };
    Supervisor.prototype.status = function (uid, jobID) {
        if (jobID === void 0) { jobID = null; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.emitter.status(uid, jobID)];
                    case 1: return [2, _a.sent()];
                }
            });
        });
    };
    Supervisor.prototype.getDownloadDir = function (jobID) {
        return __awaiter(this, void 0, void 0, function () {
            var filePath, zipFilePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        filePath = this.downloadPools[jobID];
                        if (filePath == undefined) {
                            return [2, null];
                        }
                        if (!fs.lstatSync(filePath).isDirectory()) return [3, 3];
                        zipFilePath = __dirname + '/../data/download/' + jobID + '.zip';
                        if (!!fs.existsSync(zipFilePath)) return [3, 2];
                        return [4, new Promise(function (resolve, reject) {
                                var stream = fs.createWriteStream(zipFilePath);
                                var archive = archiver('zip');
                                archive.pipe(stream);
                                archive.directory(filePath, false);
                                archive.finalize();
                                archive.on('error', function (err) {
                                    reject(err);
                                });
                                stream.on('end', function () {
                                    resolve('');
                                });
                                stream.on('close', function () {
                                    resolve('');
                                });
                            })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        filePath = zipFilePath;
                        _a.label = 3;
                    case 3: return [2, filePath];
                }
            });
        });
    };
    Supervisor.prototype._generateJobID = function () {
        return Math.round((new Date()).getTime() / 1000) + Helper_1.default.randomStr(4);
    };
    Supervisor.prototype.destroy = function () {
        clearInterval(this.maintainerThread);
    };
    return Supervisor;
}());
exports.default = Supervisor;
