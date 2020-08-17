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
var config = require('../../config.json');
var spawn = require('child-process-async').spawn;
var BaseMaintainer = (function () {
    function BaseMaintainer(manifest) {
        this._lock = false;
        this.isInit = false;
        this.isEnd = false;
        this.rawManifest = null;
        this.manifest = null;
        this.events = [];
        this.logs = [];
        this.env = {};
        this.downloadDir = undefined;
        this.allowedEnv = undefined;
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
    BaseMaintainer.prototype.runPython = function (file, args) {
        if (args === void 0) { args = []; }
        return __awaiter(this, void 0, void 0, function () {
            var child, out, self, _a, stdout, stderr, exitCode;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        args.unshift(__dirname + "/python/" + file);
                        child = spawn('python3', args, {
                            shell: true
                        });
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
                                var download = o.match(/download=\[[\s\S]*\]/g);
                                if (download != null) {
                                    download.forEach(function (v, i) {
                                        v = v.replace('download=[', '');
                                        v = v.replace(/]$/g, '');
                                        self.registerDownloadDir(v);
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
    BaseMaintainer.prototype.registerDownloadDir = function (dir) {
        this.downloadDir = dir;
    };
    BaseMaintainer.prototype.emitEvent = function (type, message) {
        if (type === 'JOB_ENDED' || type === 'JOB_FAILED') {
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
    BaseMaintainer.prototype.getJobID = function () {
        return this.manifest.id;
    };
    BaseMaintainer.prototype.emitLog = function (message) {
        this.logs.push(message);
    };
    BaseMaintainer.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this._lock) return [3, 2];
                        this._lock = true;
                        return [4, this.onInit()];
                    case 1:
                        _a.sent();
                        this._lock = false;
                        _a.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    BaseMaintainer.prototype.maintain = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this._lock) return [3, 2];
                        this._lock = true;
                        return [4, this.onMaintain()];
                    case 1:
                        _a.sent();
                        this._lock = false;
                        _a.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    BaseMaintainer.prototype.connect = function (commands, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var ssh, out;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ssh = new SSH_1.default(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd);
                        return [4, ssh.connect(this.env)];
                    case 1:
                        _a.sent();
                        return [4, ssh.exec(commands, options, this)];
                    case 2:
                        out = _a.sent();
                        return [2, out];
                }
            });
        });
    };
    BaseMaintainer.prototype.upload = function (from, to, isDirectory, fileNameValidation) {
        if (isDirectory === void 0) { isDirectory = false; }
        if (fileNameValidation === void 0) { fileNameValidation = null; }
        return __awaiter(this, void 0, void 0, function () {
            var ssh, out;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ssh = new SSH_1.default(this.rawManifest.dest, this.rawManifest.cred.usr, this.rawManifest.cred.pwd);
                        return [4, ssh.connect(this.env)];
                    case 1:
                        _a.sent();
                        if (!isDirectory) return [3, 3];
                        return [4, ssh.putDirectory(from, to, fileNameValidation)];
                    case 2:
                        out = _a.sent();
                        return [2, out];
                    case 3: return [4, ssh.putFile(from, to)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2];
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
