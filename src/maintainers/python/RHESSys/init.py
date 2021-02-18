import os
import subprocess
import sys
from cybergis import RHESSysSupervisorToHPC

# Connect to HydroShare
username = str(sys.argv[1])
key_path = str(sys.argv[2])
base_dir = str(sys.argv[3])
file_dir = str(sys.argv[4])
machine = str(sys.argv[5])
node = str(sys.argv[6])
walltime = str(sys.argv[7])
jobid = str(sys.argv[8])
partition = str(sys.argv[9])

# Init
workspace_dir = os.path.join(base_dir, "RHESSys")
model_source_folder_path = os.path.join(base_dir, file_dir)

subprocess.run(
    ["chmod", "-x", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

subprocess.run(
    ["chmod", "755", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

# save ensemble info to json files
params = {}
params["model"] = "rhessys"
params["model_source_folder_path"] = model_source_folder_path
params["workspace_dir"] = workspace_dir
params["machine"] = machine
params["node"] = node
params["walltime_hour"] = walltime
params["jobid"] = jobid
params["partition"] = partition

s = RHESSysSupervisorToHPC(params, username, key_path)

print("@event=[RHESSys_HPC_CONNECTED:connected to HPC]")

out = s.connect().submit()

print("@event=[RHESSys_HPC_SUBMITTED:submitted RHESSys job to HPC]")

for i in out.keys():
    print("@var=[" + i + ":" + out[i] + "]")

print(
    "@event=[JOB_INITIALIZED:initialized RHESSys job in HPC job queue with remote_id "
    + out["remote_id"]
    + "]"
)
