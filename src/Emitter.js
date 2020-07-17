"use strict";
exports.__esModule = true;
var Emitter = /** @class */ (function () {
    function Emitter() {
        this.events = {};
        this.logs = {};
    }
    Emitter.prototype.registerEvents = function (jobID, type, message) {
        if (this.events[jobID] === undefined) {
            this.events[jobID] = [];
        }
        this.events[jobID].push({
            type: type,
            message: message,
            at: new Date()
        });
        console.log(type, message);
    };
    Emitter.prototype.registerLogs = function (jobID, message) {
        if (this.logs[jobID] === undefined) {
            this.logs[jobID] = [];
        }
        this.logs[jobID].push({
            message: message,
            at: new Date()
        });
    };
    Emitter.prototype.status = function (jobID) {
        return {
            events: this.events[jobID],
            logs: this.logs[jobID]
        };
    };
    return Emitter;
}());
exports["default"] = Emitter;
