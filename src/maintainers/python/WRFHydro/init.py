import os
import sys
from cybergis import WRFHydroSupervisorToHPC

# Connect to HydroShare
username = str(sys.argv[1])
key_path = str(sys.argv[2])
base_dir = str(sys.argv[3])  # data folder
file_dir = str(sys.argv[4])  # upload/uid/file folder
machine = str(sys.argv[5])
node = str(sys.argv[6])
walltime = str(sys.argv[7])
jobid = str(sys.argv[8])

# Init
workspace_dir = os.path.join(base_dir, "WRFHydro")  # data/WRFHydro
model_source_folder_path = os.path.join(base_dir, file_dir)  # data/upload/uid/file

# save ensemble info to json files
params = {}
params["model"] = "wrfhydro"
params["model_source_folder_path"] = model_source_folder_path
params["workspace_dir"] = workspace_dir
params["machine"] = machine
params["node"] = node
params["walltime"] = walltime
params["jobid"] = jobid

s = WRFHydroSupervisorToHPC(params, username, key_path)

print("@event=[WRFHydro_HPC_CONNECTED:connected to HPC]")

out = s.connect().submit()

print("@event=[WRFHydro_HPC_SUBMITTED:submitted WRFHydro job to HPC]")

for i in out.keys():
    print("@var=[" + i + ":" + out[i] + "]")

print(
    "@event=[JOB_INITIALIZED:initialized WRFHydro job in HPC job queue with remote_id "
    + out["remote_id"]
    + "]"
)
