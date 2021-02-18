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
var JAT_1 = require("./JAT");
var Helper_1 = require("./Helper");
var SSH_1 = require("./SSH");
var redis = require('redis');
var config = require('../config.json');
var promisify = require("util").promisify;
var SecretTokens = (function () {
    function SecretTokens() {
        this.indexName = 'sT';
        this.redis = {
            push: null,
            keys: null,
            getValue: null,
            length: null,
            setValue: null
        };
        this.isConnected = false;
    }
    SecretTokens.prototype.add = function (sT, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _a.sent();
                        return [4, this.redis.push(this.indexName, sT)];
                    case 2:
                        _a.sent();
                        return [4, this.redis.setValue(sT, JSON.stringify(data))];
                    case 3:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    SecretTokens.prototype.getAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _a.sent();
                        return [4, this.redis.keys(this.indexName)];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    SecretTokens.prototype.getManifestByST = function (sT) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _c.sent();
                        _b = (_a = JSON).parse;
                        return [4, this.redis.getValue(sT)];
                    case 2: return [2, _b.apply(_a, [_c.sent()])];
                }
            });
        });
    };
    SecretTokens.prototype.exists = function (sT) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.connect()];
                    case 1:
                        _a.sent();
                        return [4, this.redis.getValue(sT)];
                    case 2: return [2, (_a.sent()) != undefined];
                }
            });
        });
    };
    SecretTokens.prototype.connect = function () {
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
                        this.redis.push = promisify(client.sadd).bind(client);
                        this.redis.keys = promisify(client.smembers).bind(client);
                        this.redis.getValue = promisify(client.get).bind(client);
                        this.redis.setValue = promisify(client.set).bind(client);
                        this.redis.length = promisify(client.scard).bind(client);
                        this.isConnected = true;
                        _a.label = 3;
                    case 3: return [2];
                }
            });
        });
    };
    return SecretTokens;
}());
var Guard = (function () {
    function Guard() {
        this.jat = new JAT_1.default();
        this.authenticatedAccessTokenCache = {};
        this.secretTokens = new SecretTokens();
    }
    Guard.prototype.issueSecretTokenForPrivateAccount = function (destination, user, password) {
        return __awaiter(this, void 0, void 0, function () {
            var ssh, isValid, secretToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._clearCache();
                        ssh = new SSH_1.default(destination, user, password);
                        return [4, ssh.connect()];
                    case 1:
                        _a.sent();
                        isValid = ssh.isConnected();
                        return [4, ssh.stop()];
                    case 2:
                        _a.sent();
                        if (!isValid) {
                            throw new Error('unable to check credentials with ' + destination);
                        }
                        secretToken = Helper_1.default.randomStr(45);
                        _a.label = 3;
                    case 3: return [4, this.secretTokens.exists(secretToken)];
                    case 4:
                        if (!_a.sent()) return [3, 5];
                        secretToken = Helper_1.default.randomStr(45);
                        return [3, 3];
                    case 5: return [4, this.secretTokens.add(secretToken, {
                            cred: {
                                usr: user,
                                pwd: password
                            },
                            dest: destination,
                            sT: secretToken,
                            uid: this._generateUserID()
                        })];
                    case 6:
                        _a.sent();
                        return [2, secretToken];
                }
            });
        });
    };
    Guard.prototype.issueSecretTokenForCommunityAccount = function (destination, user) {
        return __awaiter(this, void 0, void 0, function () {
            var secretToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._clearCache();
                        secretToken = Helper_1.default.randomStr(45);
                        _a.label = 1;
                    case 1: return [4, this.secretTokens.exists(secretToken)];
                    case 2:
                        if (!_a.sent()) return [3, 3];
                        secretToken = Helper_1.default.randomStr(45);
                        return [3, 1];
                    case 3: return [4, this.secretTokens.add(secretToken, {
                            cred: {
                                usr: user,
                                pwd: null
                            },
                            dest: destination,
                            sT: secretToken,
                            uid: this._generateUserID()
                        })];
                    case 4:
                        _a.sent();
                        return [2, secretToken];
                }
            });
        });
    };
    Guard.prototype.validateAccessToken = function (manifest) {
        return __awaiter(this, void 0, void 0, function () {
            var rawAT, date, cache, keys, _a, _b, _i, i, sT, secretToken, hash;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        this._clearCache();
                        rawAT = this.jat.parseAccessToken(manifest.aT);
                        date = this.jat.getDate();
                        if (rawAT.payload.decoded.date != date) {
                            throw new Error('invalid accessToken provided');
                        }
                        if (this.authenticatedAccessTokenCache[date] != undefined) {
                            cache = this.authenticatedAccessTokenCache[date][rawAT.hash];
                            if (cache != undefined) {
                                delete manifest.aT;
                                manifest.cred = cache.cred;
                                manifest.uid = cache.uid;
                                manifest.dest = cache.dest;
                                return [2, manifest];
                            }
                        }
                        return [4, this.secretTokens.getAll()];
                    case 1:
                        keys = _c.sent();
                        _a = [];
                        for (_b in keys)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3, 5];
                        i = _a[_i];
                        sT = keys[i];
                        return [4, this.secretTokens.getManifestByST(sT)];
                    case 3:
                        secretToken = _c.sent();
                        if (secretToken.dest === manifest.dest || manifest.dest === undefined) {
                            hash = this.jat.init(rawAT.alg, secretToken.sT).hash(rawAT.payload.encoded);
                            if (hash == rawAT.hash) {
                                if (this.authenticatedAccessTokenCache[date] === undefined) {
                                    this.authenticatedAccessTokenCache[date] = {};
                                }
                                this.authenticatedAccessTokenCache[date][rawAT.hash] = {
                                    cred: secretToken.cred,
                                    uid: secretToken.uid,
                                    dest: secretToken.dest
                                };
                                delete manifest.aT;
                                manifest.cred = secretToken.cred;
                                manifest.uid = secretToken.uid;
                                manifest.dest = secretToken.dest;
                                return [2, manifest];
                            }
                        }
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3, 2];
                    case 5: throw new Error('invalid accessToken provided');
                }
            });
        });
    };
    Guard.prototype.revokeSecretToken = function (secretToken) {
        delete this.secretTokens[secretToken];
    };
    Guard.prototype._clearCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var date, i;
            return __generator(this, function (_a) {
                date = this.jat.getDate();
                for (i in this.authenticatedAccessTokenCache) {
                    if (parseInt(i) < date) {
                        delete this.authenticatedAccessTokenCache[i];
                    }
                }
                return [2];
            });
        });
    };
    Guard.prototype._generateUserID = function () {
        return Math.round((new Date()).getTime() / 1000) + Helper_1.default.randomStr(4);
    };
    return Guard;
}());
exports.default = Guard;
