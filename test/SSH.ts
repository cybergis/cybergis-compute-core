import SSH from '../src/SSH'

var a = async () => {
    var ssh = new SSH('hadoop', 'xxx', 'xxx~')

    await ssh.connect()

    console.log(ssh.isConnected())

    console.log(await ssh.exec([
        function (last) {
            console.log(last)
            return 'ls'
        },
        function (last) {
            console.log(last)
            return 'cd ..;ls'
        },
        'cd /;ls',
        function (last) {
            console.log(last)
            return 'tail ~/alice.txt'
        }
    ]))

    ssh.stop()
}
a()