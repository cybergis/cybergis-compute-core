import os
import subprocess
import sys
import platform
from cybergis import SummaSupervisorToHPC

# Connect to HydroShare
username = str(sys.argv[1])
key_path = str(sys.argv[2])
base_dir = str(sys.argv[3])
file_dir = str(sys.argv[4])
machine = str(sys.argv[5])
node = str(sys.argv[6])
walltime = str(sys.argv[7])

# Init
workspace_dir = os.path.join(base_dir, "SUMMA")
model_source_folder_path = os.path.join(base_dir, file_dir)
file_manger_rel_path = "settings/summa_fileManager_riparianAspenSimpleResistance.txt"

subprocess.run(
    ["chmod", "-x", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

subprocess.run(
    ["chmod", "755", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

# save ensemble info to json files
params = {}
params["model"] = "summa"
params["model_source_folder_path"] = model_source_folder_path
params["file_manger_rel_path"] = file_manger_rel_path
params["workspace_dir"] = workspace_dir
params["machine"] = machine
params["node"] = node
params["walltime"] = walltime

s = SummaSupervisorToHPC(params, username, key_path)

print("@event=[SUMMA_HPC_CONNECTED:connected to HPC]")

out = s.connect().submit()

print("@event=[SUMMA_HPC_SUBMITTED:submitted SUMMA job to HPC]")

for i in out.keys():
    print("@var=[" + i + ":" + out[i] + "]")

print(
    "@event=[JOB_INITIALIZED:initialized SUMMA job in HPC job queue with remote_id "
    + out["remote_id"]
    + "]"
)
