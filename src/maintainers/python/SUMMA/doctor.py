import subprocess
import os
import importlib

print('🚩Python/SUMMA')
print('trying to import python dependencies...')

def checkPythonPkg(pkg):
    loader = importlib.util.find_spec(pkg)
    if loader is None:
        print('❌ python pkg ' + pkg + ' not found!')

print('package: netCDF4')
checkPythonPkg('netCDF4')
print('package: numpy')
checkPythonPkg('numpy')
print('package: platform')
checkPythonPkg('platform')
print('package: pysumma')
checkPythonPkg('pysumma')
print('package: cybergis')
checkPythonPkg('cybergis')
print('package: hs_restclient')
checkPythonPkg('hs_restclient')
print('package: tkinter')
checkPythonPkg('tkinter')
print('package: cyborgs')
checkPythonPkg('tkinter')
print('package: distributed')
checkPythonPkg('distributed')
print('package: pyproj')
checkPythonPkg('pyproj')

print('testing if BASH command exists...')

def checkBashCmd(cmd):
    out = subprocess.Popen(
        [os.getcwd() + '/src/helpers/checkBash.sh', cmd], stdout=subprocess.PIPE, stderr=subprocess.STDOUT
    )
    stdout, stderr = out.communicate()
    if b'NOT_FOUND' in stdout:
        print('❌ command ' + cmd + ' not found!')

print('command: unzip')
checkBashCmd('unzip')

print('command: grep')
checkBashCmd('grep')

print('command: curl')
checkBashCmd('curl')

print('command: source')
checkBashCmd('source')