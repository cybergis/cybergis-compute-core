import { spawn } from "child_process"
import { config } from "../../configs/config"

export default class PythonUtil {
    static async runPython(file: string, args: string[] = [], returnTags: string[] = []): Promise<any> {
        args.unshift(`${__dirname}/python/${file}`)
        const child = spawn('python3', args)

        var out = {}

        child.stdout.on('data', function (result) {
            var stdout = Buffer.from(result, 'utf-8').toString()
            var parsedStdout = stdout.split('@')
            if (config.is_testing) console.log(stdout)

            for (var i in parsedStdout) {
                var o = parsedStdout[i]
                for (var j in returnTags) {
                    var tag = returnTags[j]
                    var regex = new RegExp(`${tag}=\[[\s\S]*\]`, 'g')
                    var log = o.match(regex)
                    if (log) {
                        log.forEach((v, i) => {
                            v = v.replace('log=[', '')
                            v = v.replace(/]$/g, '')
                            out[tag] = v
                        })
                    }
                }
            }
        })

        return new Promise((resolve, reject) => {
            child.on('exit', () => {
                resolve(out)
            })
        })
    }
}