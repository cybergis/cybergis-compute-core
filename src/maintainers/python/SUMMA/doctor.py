import subprocess
import os

print('🚩Python/SUMMA')
print('trying to import python dependencies...')

print('package: netCDF4')
import netCDF4 as nc
print('package: numpy')
import numpy as np
print('package: platform')
import platform
print('package: pysumma')
from pysumma import ensemble
print('package: cybergis')
from cybergis import SummaSupervisorToHPC
print('package: hs_restclient')
from hs_restclient import HydroShare, HydroShareAuthBasic

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