import { spawn } from "child_process"
import { config } from "../../configs/config"

export default class PythonUtil {

    static async runInteractive(file: string, args: string[] = [], returnTags: string[] = []) {
        args.unshift(`${__dirname}/python/${file}`)
        const child = spawn('python3', args)
        var out = {}

        child.stdout.on('data', function (result) {
            var stdout = Buffer.from(result, 'utf-8').toString()
            var parsedStdout = stdout.split('@')

            for (var i in parsedStdout) {
                var o = parsedStdout[i]
                for (var j in returnTags) {
                    var tag = returnTags[j]
                    var regex = new RegExp(`${tag}=((?!\]).)*`, 'g')
                    var m = o.match(regex)
                    if (m) {
                        m.forEach((v, i) => {
                            v = v.replace(`${tag}=[`, '')
                            out[tag] = v
                        })
                        stdout = stdout.replace('@', '')
                        stdout = stdout.replace(regex, '')
                        stdout = stdout.replace(']', '')
                    }
                }
            }

            console.log(stdout)
        })

        process.stdin.on('readable', () => {
            const chunk = process.stdin.read()
            if (chunk !== null) child.stdin.write(chunk)
        })

        return new Promise((resolve, reject) => {
            child.on('exit', () => { resolve(out) })
            child.on('error', () => { resolve(out) })
            child.on('close', () => { resolve(out) })
        })
    }

    static async run(file: string, args: string[] = [], returnTags: string[] = []): Promise<any> {
        args.unshift(`${__dirname}/python/${file}`)
        const child = spawn('python3', args)

        var out = {}

        child.stdout.on('data', function (result) {
            var stdout = Buffer.from(result, 'utf-8').toString()
            var parsedStdout = stdout.split('@')

            for (var i in parsedStdout) {
                var o = parsedStdout[i]
                for (var j in returnTags) {
                    var tag = returnTags[j]
                    var regex = new RegExp(`${tag}=((?!\]).)*`, 'g')
                    var m = o.match(regex)
                    if (m) {
                        m.forEach((v, i) => {
                            v = v.replace(`${tag}=[`, '')
                            out[tag] = v
                        })
                        stdout = stdout.replace('@', '')
                        stdout = stdout.replace(regex, '')
                        stdout = stdout.replace(']', '')
                    }
                }
            }

            if(config.is_testing) console.log(stdout)
        })

        if (config.is_testing) {
            child.stderr.on('data', function (result) {
                console.log(Buffer.from(result, 'utf-8').toString())
            })
        }

        return new Promise((resolve, reject) => {
            child.on('exit', () => { resolve(out) })
            child.on('error', (err) => { reject(err) })
            child.on('close', () => { resolve(out) })
        })
    }
}