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
exports.__esModule = true;
var Queue_1 = require("./Queue");
var Emitter_1 = require("./Emitter");
var Helper_1 = require("./Helper");
var constant_1 = require("./constant");
var Supervisor = /** @class */ (function () {
    function Supervisor() {
        this.jobPoolCapacity = 5;
        this.jobPool = [];
        this.queue = new Queue_1["default"]();
        this.emitter = new Emitter_1["default"]();
        this.worker = null;
        this.workerTimePeriodInSeconds = 1;
        var self = this;
        this.worker = setInterval(function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _i, i, job, events, logs, i, event, i, job, maintainer;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!(self.jobPool.length > 0)) return [3 /*break*/, 7];
                            console.log(self.jobPool);
                            _a = [];
                            for (_b in self.jobPool)
                                _a.push(_b);
                            _i = 0;
                            _c.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 7];
                            i = _a[_i];
                            job = self.jobPool[i];
                            if (!job.maintainer.isInit) return [3 /*break*/, 3];
                            return [4 /*yield*/, job.onMaintain()];
                        case 2:
                            _c.sent();
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, job.onInit()];
                        case 4:
                            _c.sent();
                            _c.label = 5;
                        case 5:
                            events = job.dumpEvents();
                            logs = job.dumpLogs();
                            for (i in events) {
                                event = events[i];
                                self.emitter.registerEvents(job.getJobID(), event.type, event.message);
                            }
                            for (i in logs) {
                                self.emitter.registerLogs(job.getJobID(), logs[i]);
                            }
                            if (job.maintainer.isEnd) {
                                delete job.jobPool[i];
                            }
                            _c.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 1];
                        case 7:
                            while (self.jobPool.length < self.jobPoolCapacity && !self.queue.isEmpty()) {
                                job = self.queue.shift();
                                maintainer = require('./maintainers/' + constant_1["default"].destinationMap[job.dest].maintainer);
                                job.maintainer = new maintainer(job);
                                self.jobPool.push(job);
                                self.emitter.registerEvents(job.id, 'JOB_REGISTERED', 'job [' + job.id + '] is registered with the supervisor, waiting for initialization');
                            }
                            return [2 /*return*/];
                    }
                });
            });
        }, this.workerTimePeriodInSeconds * 1000);
    }
    Supervisor.prototype.add = function (manifest) {
        manifest.id = this._generateJobID();
        this.queue.push(manifest);
        this.emitter.registerEvents(manifest.id, 'JOB_QUEUED', 'job [' + manifest.id + '] is queued, waiting for registration');
        return manifest;
    };
    Supervisor.prototype.status = function (jobID) {
        return this.emitter.status(jobID);
    };
    Supervisor.prototype._generateJobID = function () {
        return Math.round((new Date()).getTime() / 1000) + Helper_1["default"].randomStr(2);
    };
    return Supervisor;
}());
exports["default"] = Supervisor;
