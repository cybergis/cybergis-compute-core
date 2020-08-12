import constant from './src/constant'
const { spawn } = require('child-process-async')

async function pythonTest() {
    for (var i in constant.doctorScripts.python) {
        var script = constant.doctorScripts.python[i]
        const child = spawn('python3', [script])
        child.stdout.on('data', function (result) {
            var stdout = Buffer.from(result, 'utf-8').toString()
            console.log(stdout)
        })

        const { stdout, stderr, exitCode } = await child

        console.log(stderr.toString())
    }
}

pythonTest()