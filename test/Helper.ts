import Helper from '../src/Helper'

var a = async () => {
    var tmp = await Helper.ssh('hadoop', 'xxx', 'xxx', [
        'ls',
        'cd ..',
        'ls'
    ], {
        cwd: '/'
    })
    console.log(tmp)

    var s = await Helper.checkSSHLogin('hadoop', 'xxx', 'xxx')
    console.log(s)
}

a()