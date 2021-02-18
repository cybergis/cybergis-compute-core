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
var redis = require('redis');
var config = require('../config.json');
var promisify = require("util").promisify;
var Emitter = (function () {
    function Emitter() {
        this.events = {};
        this.logs = {};
        this.isConnected = false;
        this.redis = {
            push: null,
            fetch: null,
            indexFetch: null,
            indexPush: null
        };
    }
    Emitter.prototype.registerEvents = function (uid, jobID, type, message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _a.sent();
                        return [4, this.redis.indexPush('event_' + uid, 'event_' + uid + '_' + jobID)];
                    case 2:
                        _a.sent();
                        return [4, this.redis.push(['event_' + uid + '_' + jobID, JSON.stringify({
                                    type: type,
                                    message: message,
                                    at: new Date()
                                })])];
                    case 3:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    Emitter.prototype.registerLogs = function (uid, jobID, message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _a.sent();
                        return [4, this.redis.indexPush('log_' + uid, 'log_' + uid + '_' + jobID)];
                    case 2:
                        _a.sent();
                        return [4, this.redis.push(['log_' + uid + '_' + jobID, JSON.stringify({
                                    message: message,
                                    at: new Date()
                                })])];
                    case 3:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    Emitter.prototype.status = function (uid, jobID) {
        var jobID, jobID;
        if (jobID === void 0) { jobID = null; }
        return __awaiter(this, void 0, void 0, function () {
            var usrLogs, usrEvents, logIndex, eventIndex, _a, _b, _i, i, logs, i, _c, _d, _e, i, events, i, events, logs, i, i;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _f.sent();
                        if (!(jobID === null)) return [3, 12];
                        usrLogs = {};
                        usrEvents = {};
                        return [4, this.redis.indexFetch('log_' + uid)];
                    case 2:
                        logIndex = _f.sent();
                        return [4, this.redis.indexFetch('event_' + uid)];
                    case 3:
                        eventIndex = _f.sent();
                        _a = [];
                        for (_b in logIndex)
                            _a.push(_b);
                        _i = 0;
                        _f.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3, 7];
                        i = _a[_i];
                        jobID = logIndex[i].replace('log_' + uid + '_', '');
                        return [4, this.redis.fetch(logIndex[i], 0, -1)];
                    case 5:
                        logs = _f.sent();
                        for (i in logs) {
                            logs[i] = JSON.parse(logs[i]);
                        }
                        usrLogs[jobID] = logs;
                        _f.label = 6;
                    case 6:
                        _i++;
                        return [3, 4];
                    case 7:
                        _c = [];
                        for (_d in eventIndex)
                            _c.push(_d);
                        _e = 0;
                        _f.label = 8;
                    case 8:
                        if (!(_e < _c.length)) return [3, 11];
                        i = _c[_e];
                        jobID = eventIndex[i].replace('event_' + uid + '_', '');
                        return [4, this.redis.fetch(eventIndex[i], 0, -1)];
                    case 9:
                        events = _f.sent();
                        for (i in events) {
                            events[i] = JSON.parse(events[i]);
                        }
                        usrEvents[jobID] = events;
                        _f.label = 10;
                    case 10:
                        _e++;
                        return [3, 8];
                    case 11: return [2, {
                            events: usrEvents,
                            logs: usrLogs
                        }];
                    case 12: return [4, this.redis.fetch('event_' + uid + '_' + jobID, 0, -1)];
                    case 13:
                        events = _f.sent();
                        return [4, this.redis.fetch('log_' + uid + '_' + jobID, 0, -1)];
                    case 14:
                        logs = _f.sent();
                        for (i in events) {
                            events[i] = JSON.parse(events[i]);
                        }
                        for (i in logs) {
                            logs[i] = JSON.parse(logs[i]);
                        }
                        return [2, {
                                events: events,
                                logs: logs
                            }];
                }
            });
        });
    };
    Emitter.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var client, redisAuth;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.isConnected) return [3, 3];
                        client = new redis.createClient({
                            host: config.redis.host,
                            port: config.redis.port
                        });
                        if (!(config.redis.password != null && config.redis.password != undefined)) return [3, 2];
                        redisAuth = promisify(client.auth).bind(client);
                        return [4, redisAuth(config.redis.password)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.redis.push = promisify(client.rpush).bind(client);
                        this.redis.fetch = promisify(client.lrange).bind(client);
                        this.redis.indexPush = promisify(client.sadd).bind(client);
                        this.redis.indexFetch = promisify(client.smembers).bind(client);
                        this.isConnected = true;
                        _a.label = 3;
                    case 3: return [2];
                }
            });
        });
    };
    return Emitter;
}());
exports.default = Emitter;
