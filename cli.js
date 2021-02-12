"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var Guard_1 = require("./src/Guard");
var npmPkg = require('./package.json');
var cmd = new commander_1.Command();
cmd.version(npmPkg.version);
function getDate() {
    var current = new Date();
    var y = current.getUTCFullYear();
    var m = current.getUTCMonth() + 1;
    var d = current.getUTCDate();
    var yStr = y.toString();
    var mStr = m < 10 ? '0' + m.toString() : m.toString();
    var dStr = d < 10 ? '0' + d.toString() : d.toString();
    return yStr + '-' + mStr + '-' + dStr;
}
cmd.command('serve')
    .action(function () {
    var date = getDate();
    var forever = require('forever');
    forever.startDaemon('server.js', {
        max: 3,
        args: [],
        uid: 'server-' + date,
        append: true,
        killSignal: 'SIGTERM',
        silent: true,
        root: __dirname,
        script: 'cli.js',
        logFile: __dirname + '/log/' + 'server-' + date + '.log',
        outFile: __dirname + '/log/' + 'server-' + date + '-out.log',
        errFile: __dirname + '/log/' + 'server-' + date + '-error.log',
    });
    console.log('server is running in background as a subprocess');
    console.log('output, error, and log files are under ./log folder');
});
cmd.command('background <operation>')
    .option('-i, --index <index>', '[operation=stop] input is the first item in the row when running list operation (ex. [0])')
    .action(function (operation, cmd) {
    var forever = require('forever');
    switch (operation) {
        case 'list':
            forever.list(true, function (err, msg) {
                console.log(msg);
            });
            break;
        case 'stop-all':
            var runtime = forever.stopAll(true);
            runtime.on('error', function () {
            });
            console.log('successfully stopped all background tasks');
            break;
        case 'stop':
            if (cmd.index == undefined) {
                console.error('-i, --index must be provided in stop operation');
                process.exit(1);
            }
            forever.stop(cmd.index);
            break;
        default:
            console.error('<operation> invalid operation, only support [revoke/generate/display]');
            break;
    }
});
cmd.command('revoke <sT>')
    .action(function (sT) { return __awaiter(_this, void 0, void 0, function () {
    var secretTokens;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                secretTokens = new Guard_1.SecretTokens();
                return [4, secretTokens.revoke(sT)];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); });
cmd.command('check-user <uid>')
    .action(function (uid) { return __awaiter(_this, void 0, void 0, function () {
    var secretTokens, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                secretTokens = new Guard_1.SecretTokens();
                _b = (_a = console).log;
                return [4, secretTokens.getManifestBtUid(uid)];
            case 1:
                _b.apply(_a, [_c.sent()]);
                return [2];
        }
    });
}); });
cmd.parse(process.argv);
