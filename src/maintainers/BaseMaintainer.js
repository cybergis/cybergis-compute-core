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
Object.defineProperty(exports, "__esModule", { value: true });
var Helper_1 = require("../Helper");
var SSH_1 = require("../SSH");
var File_1 = require("../File");
var config = require('../../config.json');
var path = require('path');
var fs = require('fs');
var spawn = require('child-process-async').spawn;
var BaseMaintainer = (function () {
    function BaseMaintainer(manifest) {
        this._lock = false;
        this.isInit = false;
        this.isEnd = false;
        this.events = [];
        this.logs = [];
        this.uploadedPath = undefined;
        this.downloadedPath = undefined;
        this.lifeCycleState = {
            initCounter: 0,
            initThresholdInCount: 3,
            createdAt: null,
            maintainThresholdInHours: 0.0001
        };
        this.file = new File_1.default();
        this.env = {};
        this.rawManifest = null;
        this.manifest = null;
        this.allowedEnv = undefined;
        this.removeFileAfterJobFinished = true;
        this.define();
        if (this.allowedEnv === undefined) {
            manifest.env = {};
        }
        var env = {};
        for (var i in this.allowedEnv) {
            var val = manifest.env[i];
            if (val != undefined) {
                var type = this.allowedEnv[i];
                if (Array.isArray(type)) {
                    if (type.includes(val)) {
                        env[i] = val;
                    }
                }
                else if (typeof val === type) {
                    env[i] = val;
                }
            }
        }
        this.env = env;
        this.rawManifest = manifest;
        this.manifest = Helper_1.default.hideCredFromManifest(manifest);
        this.SSH = new SSH_1.default(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd, this);
    }
    BaseMaintainer.prototype.define = function () {
    };
    BaseMaintainer.prototype.onInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2];
            });
        });
    };
    BaseMaintainer.prototype.onMaintain = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2];
            });
        });
    };
    BaseMaintainer.prototype.runBash = function (pipeline, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var out;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.SSH.connect(this.env)];
                    case 1:
                        _a.sent();
                        return [4, this.SSH.exec(pipeline, options)];
                    case 2:
                        out = _a.sent();
                        return [2, out];
                }
            });
        });
    };
    BaseMaintainer.prototype.runPython = function (file, args) {
        if (args === void 0) { args = []; }
        return __awaiter(this, void 0, void 0, function () {
            var child, out, self, _a, stdout, stderr, exitCode;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        args.unshift(__dirname + "/python/" + file);
                        child = spawn('python3', args);
                        out = {};
                        self = this;
                        child.stdout.on('data', function (result) {
                            var stdout = Buffer.from(result, 'utf-8').toString();
                            if (config.isTesting) {
                                console.log(stdout);
                            }
                            var parsedStdout = stdout.split('@');
                            for (var i in parsedStdout) {
                                var o = parsedStdout[i];
                                var log = o.match(/log=\[[\s\S]*\]/g);
                                if (log != null) {
                                    log.forEach(function (v, i) {
                                        v = v.replace('log=[', '');
                                        v = v.replace(/]$/g, '');
                                        self.emitLog(v);
                                    });
                                }
                                var event = o.match(/event=\[[\s\S]*:[\s\S]*\]/g);
                                if (event != null) {
                                    event.forEach(function (v, i) {
                                        v = v.replace('event=[', '');
                                        v = v.replace(/]$/g, '');
                                        var e = v.split(':');
                                        self.emitEvent(e[0], e[1]);
                                    });
                                }
                                var variable = o.match(/var=\[[\s\S]*:[\s\S]*\]/g);
                                if (variable != null) {
                                    variable.forEach(function (v, i) {
                                        v = v.replace('var=[', '');
                                        v = v.replace(/]$/g, '');
                                        var e = v.split(':');
                                        out[e[0]] = e[1];
                                    });
                                }
                                var download = o.match(/custom_downloaded_path=\[[\s\S]*\]/g);
                                if (download != null) {
                                    download.forEach(function (v, i) {
                                        v = v.replace('custom_downloaded_path=[', '');
                                        v = v.replace(/]$/g, '');
                                        self.registerCustomDownloadedPath(v);
                                    });
                                }
                            }
                        });
                        return [4, child];
                    case 1:
                        _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr, exitCode = _a.exitCode;
                        if (config.isTesting) {
                            console.log(stderr.toString());
                        }
                        return [2, out];
                }
            });
        });
    };
    BaseMaintainer.prototype.upload = function (destinationRootPath) {
        return __awaiter(this, void 0, void 0, function () {
            var sourcePath, destinationPath, uploadResult, uploadCounter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePath = __dirname + '/../../data/upload/' + this.rawManifest.uid + '/' + this.rawManifest.file;
                        if (!fs.existsSync(sourcePath)) {
                            throw new Error('file path ' + sourcePath + ' does not exist');
                        }
                        return [4, this.SSH.connect(this.env)];
                    case 1:
                        _a.sent();
                        destinationPath = path.join(destinationRootPath, this.rawManifest.file);
                        return [4, this.SSH.putDirectory(sourcePath, destinationPath)];
                    case 2:
                        uploadResult = _a.sent();
                        uploadCounter = 1;
                        _a.label = 3;
                    case 3:
                        if (!(uploadResult.failed.length > 0 && uploadCounter <= 3)) return [3, 5];
                        return [4, this.SSH.putDirectory(sourcePath, destinationPath)];
                    case 4:
                        uploadResult = _a.sent();
                        uploadCounter += 1;
                        return [3, 3];
                    case 5:
                        if (uploadResult.failed.length > 0) {
                            this.emitEvent('FILES_UPLOAD_FAIL', 'upload failed after three times of attempt.');
                            throw new Error('upload failed after three times of attempt. Failed files: ' + JSON.stringify(uploadResult.failed));
                        }
                        this.emitEvent('FILES_UPLOADED', 'files uploaded to destination.');
                        this.uploadedPath = destinationPath;
                        return [2, destinationPath];
                }
            });
        });
    };
    BaseMaintainer.prototype.download = function (sourceRootPath) {
        return __awaiter(this, void 0, void 0, function () {
            var destinationPath, fileName, sourcePath, uploadCounter, tarFilePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        destinationPath = __dirname + '/../../data/download/';
                        fileName = this.rawManifest.id + '.tar';
                        return [4, this.SSH.connect(this.env)];
                    case 1:
                        _a.sent();
                        sourcePath = path.join(sourceRootPath, this.rawManifest.file);
                        return [4, this.SSH.getDirectoryZipped(sourcePath, destinationPath, fileName)];
                    case 2:
                        _a.sent();
                        uploadCounter = 1;
                        tarFilePath = path.join(destinationPath, fileName);
                        _a.label = 3;
                    case 3:
                        if (!(!fs.existsSync(tarFilePath) && uploadCounter <= 3)) return [3, 5];
                        return [4, this.SSH.getDirectoryZipped(sourcePath, fileName)];
                    case 4:
                        _a.sent();
                        return [3, 3];
                    case 5:
                        if (!fs.existsSync(tarFilePath)) {
                            this.emitEvent('FILES_DOWNLOAD_FAIL', 'download failed after three times of attempt.');
                            throw new Error('download failed after three times of attempt.');
                        }
                        this.emitEvent('FILES_DOWNLOADED', 'files downloaded to from destination.');
                        this.downloadedPath = tarFilePath;
                        return [2, tarFilePath];
                }
            });
        });
    };
    BaseMaintainer.prototype.registerCustomDownloadedPath = function (downloadedPath) {
        this.downloadedPath = downloadedPath;
    };
    BaseMaintainer.prototype.removeUploadedFile = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.uploadedPath != undefined) {
                    this.runBash(['rm -rf ' + this.uploadedPath]);
                }
                return [2];
            });
        });
    };
    BaseMaintainer.prototype.getRemoteHomePath = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.SSH.connect(this.env)];
                    case 1:
                        _a.sent();
                        return [4, this.SSH.getRemoteHomePath()];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    BaseMaintainer.prototype.injectRuntimeFlagsToFile = function (filePath, lang) {
        var supportedLangs = ['python'];
        lang = lang.toLowerCase();
        if (!supportedLangs.includes(lang)) {
            throw new Error('language not supported');
        }
        var sourcePath = __dirname + '/../../data/upload/' + this.rawManifest.uid + '/' + this.rawManifest.file;
        if (!fs.existsSync(sourcePath)) {
            throw new Error('file path ' + sourcePath + ' does not exist');
        }
        filePath = path.join(sourcePath, filePath);
        if (!fs.existsSync(filePath)) {
            throw new Error('file path ' + filePath + ' does not exist');
        }
        var flags = {
            end: '@flag=[SCRIPT_ENDED:script ' + filePath + ' job [' + this.manifest.id + '] finished]'
        };
        for (var i in flags) {
            if (lang == 'python') {
                flags[i] = 'print("' + flags[i] + '")';
            }
        }
        fs.appendFileSync(filePath, "\n" + flags.end);
    };
    BaseMaintainer.prototype.emitEvent = function (type, message) {
        if (type === 'JOB_ENDED' || type === 'JOB_FAILED') {
            if (this.removeFileAfterJobFinished) {
                this.removeUploadedFile();
            }
            this.isEnd = true;
        }
        if (type === 'JOB_INITIALIZED') {
            this.isInit = true;
        }
        this.events.push({
            type: type,
            message: message
        });
    };
    BaseMaintainer.prototype.emitLog = function (message) {
        this.logs.push(message);
    };
    BaseMaintainer.prototype.getJobID = function () {
        return this.manifest.id;
    };
    BaseMaintainer.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this._lock) return [3, 4];
                        this._lock = true;
                        if (!(this.lifeCycleState.initCounter >= this.lifeCycleState.initThresholdInCount)) return [3, 1];
                        this.emitEvent('JOB_FAILED', 'initialization counter exceeds ' + this.lifeCycleState.initThresholdInCount + ' counts');
                        return [3, 3];
                    case 1: return [4, this.onInit()];
                    case 2:
                        _a.sent();
                        this.lifeCycleState.initCounter++;
                        _a.label = 3;
                    case 3:
                        this._lock = false;
                        _a.label = 4;
                    case 4: return [2];
                }
            });
        });
    };
    BaseMaintainer.prototype.maintain = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this._lock) return [3, 4];
                        this._lock = true;
                        if (this.lifeCycleState.createdAt === null) {
                            this.lifeCycleState.createdAt = Date.now();
                        }
                        if (!(((this.lifeCycleState.createdAt - Date.now()) / (1000 * 60 * 60)) >= this.lifeCycleState.maintainThresholdInHours)) return [3, 1];
                        this.emitEvent('JOB_FAILED', 'maintain time exceeds ' + this.lifeCycleState.maintainThresholdInHours + ' hours');
                        return [3, 3];
                    case 1: return [4, this.onMaintain()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        this._lock = false;
                        _a.label = 4;
                    case 4: return [2];
                }
            });
        });
    };
    BaseMaintainer.prototype.dumpEvents = function () {
        var events = this.events;
        this.events = [];
        return events;
    };
    BaseMaintainer.prototype.dumpLogs = function () {
        var logs = this.logs;
        this.logs = [];
        return logs;
    };
    return BaseMaintainer;
}());
exports.default = BaseMaintainer;
