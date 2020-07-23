"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Emitter = (function () {
    function Emitter() {
        this.events = {};
        this.logs = {};
    }
    Emitter.prototype.registerEvents = function (uid, jobID, type, message) {
        if (this.events[uid] === undefined) {
            this.events[uid] = {};
        }
        if (this.events[uid][jobID] === undefined) {
            this.events[uid][jobID] = [];
        }
        this.events[uid][jobID].push({
            type: type,
            message: message,
            at: new Date()
        });
    };
    Emitter.prototype.registerLogs = function (uid, jobID, message) {
        if (this.logs[uid] === undefined) {
            this.logs[uid] = {};
        }
        if (this.logs[uid][jobID] === undefined) {
            this.logs[uid][jobID] = [];
        }
        this.logs[uid][jobID].push({
            message: message,
            at: new Date()
        });
    };
    Emitter.prototype.status = function (uid, jobID) {
        if (jobID === void 0) { jobID = null; }
        if (jobID === null) {
            var usrEvents = {};
            var usrLogs = {};
            if (this.events[uid] != undefined) {
                usrEvents = this.events[uid];
            }
            if (this.logs[uid] != undefined) {
                usrLogs = this.logs[uid];
            }
            return {
                events: usrEvents,
                logs: usrLogs
            };
        }
        else {
            var events = [];
            var logs = [];
            if (this.events[uid] != undefined) {
                if (this.events[uid][jobID] != undefined) {
                    events = this.events[uid][jobID];
                }
            }
            if (this.logs[uid] != undefined) {
                if (this.logs[uid][jobID] != undefined) {
                    logs = this.logs[uid][jobID];
                }
            }
            return {
                events: events,
                logs: logs
            };
        }
    };
    return Emitter;
}());
exports.default = Emitter;
