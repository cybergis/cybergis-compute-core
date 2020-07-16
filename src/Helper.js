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
var Contants_1 = require("./Contants");
var NodeSSH = require('node-ssh');
var ssh = new NodeSSH();
var Helper = {
    btoa: function (target) {
        return Buffer.from(target, 'base64').toString('binary');
    },
    atob: function (target) {
        return Buffer.from(target).toString('base64');
    },
    checkSSHLogin: function (destination, user, password) {
        return __awaiter(this, void 0, void 0, function () {
            var server, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        server = Contants_1["default"].destinationMap[destination];
                        if (server === undefined) {
                            throw Error('cannot identify server from destination name ' + destination);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, ssh.connect({
                                host: server.ip,
                                port: server.port,
                                username: user,
                                password: password
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, ssh.dispose()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 4:
                        e_1 = _a.sent();
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    },
    ssh: function (destination, user, password, commands, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var server, opt, out, _a, _b, _i, i, cmd, o;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        server = Contants_1["default"].destinationMap[destination];
                        if (server === undefined) {
                            throw Error('cannot identify server from destination name ' + destination);
                        }
                        return [4 /*yield*/, ssh.connect({
                                host: server.ip,
                                port: server.port,
                                username: user,
                                password: password
                            })];
                    case 1:
                        _c.sent();
                        opt = Object.assign({
                            onStdout: function (out) {
                                if (o.out === null) {
                                    o.out = out.toString();
                                }
                                else {
                                    o.out += out.toString();
                                }
                            },
                            onStderr: function (out) {
                                if (o.error === null) {
                                    o.error = out.toString();
                                }
                                else {
                                    o.error += out.toString();
                                }
                            }
                        }, options);
                        out = [];
                        _a = [];
                        for (_b in commands)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        i = _a[_i];
                        cmd = commands[i];
                        o = {
                            cmd: cmd,
                            out: null,
                            error: null
                        };
                        return [4 /*yield*/, ssh.execCommand(cmd, opt)];
                    case 3:
                        _c.sent();
                        out.push(o);
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, ssh.dispose()];
                    case 6:
                        _c.sent();
                        return [2 /*return*/, out];
                }
            });
        });
    },
    onExit: function (callback) {
        //do something when app is closing
        process.on('exit', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
        //catches ctrl+c event
        process.on('SIGINT', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
        process.on('SIGUSR2', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
        process.on('SIGTERM', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
        process.on('uncaughtException', function () {
            callback();
            setTimeout(function () {
                process.exit(1);
            }, 3 * 1000);
        });
    },
    consoleEnd: '\x1b[0m',
    consoleGreen: '\x1b[32m'
};
exports["default"] = Helper;
