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
var JAT_1 = require("./JAT");
var Helper_1 = require("./Helper");
var SSH_1 = require("./SSH");
var Guard = /** @class */ (function () {
    function Guard() {
        this.secretTokens = {};
        this.jat = new JAT_1["default"]();
        this.authenticatedAccessTokenCache = {};
    }
    Guard.prototype.issueSecretToken = function (destination, user, password) {
        return __awaiter(this, void 0, void 0, function () {
            var ssh, isValid, secretToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._clearCache();
                        ssh = new SSH_1["default"](destination, user, password);
                        return [4 /*yield*/, ssh.connect()];
                    case 1:
                        _a.sent();
                        isValid = ssh.isConnected();
                        return [4 /*yield*/, ssh.stop()];
                    case 2:
                        _a.sent();
                        if (!isValid) {
                            throw new Error('unable to check credentials with ' + destination);
                        }
                        secretToken = Helper_1["default"].randomStr(45);
                        while (this.secretTokens[secretToken] != undefined) {
                            secretToken = Helper_1["default"].randomStr(45);
                        }
                        this.secretTokens[secretToken] = {
                            cred: {
                                usr: user,
                                pwd: password
                            },
                            dest: destination,
                            sT: secretToken
                        };
                        return [2 /*return*/, secretToken];
                }
            });
        });
    };
    Guard.prototype.validateAccessToken = function (manifest) {
        this._clearCache();
        var rawAT = this.jat.parseAccessToken(manifest.aT);
        var date = this.jat.getDate();
        if (rawAT.payload.decoded.date != date) {
            throw new Error('invalid accessToken provided');
        }
        if (this.authenticatedAccessTokenCache[date] != undefined) {
            var cred = this.authenticatedAccessTokenCache[date][rawAT.hash];
            if (cred != undefined) {
                delete manifest.aT;
                manifest.cred = cred;
                return manifest;
            }
        }
        for (var i in this.secretTokens) {
            var secretToken = this.secretTokens[i];
            if (secretToken.dest === manifest.dest) {
                var hash = this.jat.init(rawAT.alg, secretToken.sT).hash(rawAT.payload.encoded);
                if (hash == rawAT.hash) {
                    if (this.authenticatedAccessTokenCache[date] === undefined) {
                        this.authenticatedAccessTokenCache[date] = {};
                    }
                    this.authenticatedAccessTokenCache[date][rawAT.hash] = secretToken.cred;
                    delete manifest.aT;
                    manifest.cred = secretToken.cred;
                    return manifest;
                }
            }
        }
        throw new Error('invalid accessToken provided');
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
                return [2 /*return*/];
            });
        });
    };
    return Guard;
}());
exports["default"] = Guard;
