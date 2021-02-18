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
var Helper_1 = require("./Helper");
var JAT = (function () {
    function JAT() {
        this.accessTokenCache = {};
        this.secretToken = null;
        this.algorithm = null;
        this.algorithmName = null;
    }
    JAT.prototype.init = function (algorithm, secretToken) {
        try {
            this.algorithm = require('crypto-js/' + algorithm);
        }
        catch (_a) {
            throw Error('encryption algorithm not supported by crypto-js package, please refer to https://github.com/brix/crypto-js');
        }
        this.algorithmName = algorithm;
        this.secretToken = secretToken;
        this.accessTokenCache = {};
        return this;
    };
    JAT.prototype.getAccessToken = function () {
        this._checkInit();
        var date = this._date();
        var accessToken = this.accessTokenCache[date];
        if (accessToken == undefined) {
            var payload = this._encodeJSON({
                date: date
            });
            var alg = this._encodeStr(this.algorithmName);
            var hash = this.hash(payload);
            accessToken = alg + '.' + payload + '.' + hash;
            this.accessTokenCache[date] = accessToken;
            this._clearCache();
        }
        return accessToken;
    };
    JAT.prototype.parseAccessToken = function (accessToken) {
        var aT = accessToken.split('.');
        if (aT.length != 3) {
            throw Error('invalid accessToken');
        }
        return {
            alg: this._decodeStr(aT[0]),
            payload: {
                encoded: aT[1],
                decoded: this._decodeJSON(aT[1])
            },
            hash: aT[2]
        };
    };
    JAT.prototype.hash = function (payload) {
        return this.algorithm(this.secretToken + payload).toString();
    };
    JAT.prototype.getDate = function () {
        return this._date();
    };
    JAT.prototype._clearCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            var date, i;
            return __generator(this, function (_a) {
                date = this._date();
                for (i in this.accessTokenCache) {
                    if (parseInt(i) < date) {
                        delete this.accessTokenCache[i];
                    }
                }
                return [2];
            });
        });
    };
    JAT.prototype._date = function () {
        var current = new Date();
        var y = current.getUTCFullYear();
        var m = current.getUTCMonth() + 1;
        var d = current.getUTCDate();
        var h = current.getUTCHours();
        var mStr = m < 10 ? '0' + m.toString() : m.toString();
        var dStr = d < 10 ? '0' + d.toString() : d.toString();
        var hStr = h < 10 ? '0' + h.toString() : h.toString();
        return parseInt(y + mStr + dStr + hStr);
    };
    JAT.prototype._encodeJSON = function (target) {
        return Helper_1.default.atob(JSON.stringify(target));
    };
    JAT.prototype._decodeJSON = function (target) {
        return JSON.parse(Helper_1.default.btoa(target));
    };
    JAT.prototype._encodeStr = function (target) {
        return Helper_1.default.atob(target);
    };
    JAT.prototype._decodeStr = function (target) {
        return Helper_1.default.btoa(target);
    };
    JAT.prototype._checkInit = function () {
        if (this.algorithm == null || this.secretToken == null || this.algorithmName == null) {
            throw Error('please init object before getting accessToken');
        }
    };
    return JAT;
}());
exports.default = JAT;
