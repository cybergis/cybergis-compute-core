"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
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
    .description('config file helper')
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
cmd.parse(process.argv);
