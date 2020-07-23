"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Queue = (function () {
    function Queue() {
        this.queue = [];
    }
    Queue.prototype.push = function (item) {
        this.queue.push(item);
    };
    Queue.prototype.shift = function () {
        return this.queue.shift();
    };
    Queue.prototype.isEmpty = function () {
        return this.queue.length === 0;
    };
    Queue.prototype.peak = function () {
        return this.isEmpty() ? undefined : this.queue[0];
    };
    Queue.prototype.length = function () {
        return this.queue.length;
    };
    return Queue;
}());
exports.default = Queue;
