"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var FileFormatError = (function (_super) {
    __extends(FileFormatError, _super);
    function FileFormatError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "FileFormatError";
        return _this;
    }
    return FileFormatError;
}(Error));
exports.FileFormatError = FileFormatError;
var FileStructureError = (function (_super) {
    __extends(FileStructureError, _super);
    function FileStructureError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = "FileStructureError";
        return _this;
    }
    return FileStructureError;
}(Error));
exports.FileStructureError = FileStructureError;
