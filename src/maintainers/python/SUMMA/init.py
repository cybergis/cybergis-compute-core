import os
import subprocess
import netCDF4 as nc
import sys
import numpy as np
import platform
from pysumma import ensemble
from cybergis import SummaSupervisorToHPC
from hs_restclient import HydroShare, HydroShareAuthBasic


def safe_arange(start, stop, step):
    a = np.arange(start, stop, step)

    result = []
    for i in a:
        par = round(i, 10)
        result = np.append(result, par)
    return result


resource_id = "1f3f310af8364d2aa3e6a9459152a21c"

# Connect to HydroShare
auth = HydroShareAuthBasic("cybergis", "demo")
hs = HydroShare(auth=auth)
username = str(sys.argv[1])
key_path = str(sys.argv[2])
base_dir = str(sys.argv[3])
download_dir = base_dir + "/model"

# Get the metadata of the resource
metadata = hs.getScienceMetadata(resource_id)
timestamp = resource_id + ";" + metadata["dates"][1]["start_date"]
out = subprocess.Popen(
    ["ls", base_dir], stdout=subprocess.PIPE, stderr=subprocess.STDOUT
)
stdout, stderr = out.communicate()
out2 = subprocess.Popen(
    ["grep", timestamp, base_dir + "/managementfile"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)
stdout2, stderr2 = out2.communicate()

if resource_id.encode("utf-8") not in stdout or stdout2 == b"":
    hs.getResource(resource_id, destination=download_dir, unzip=True)
    with open(base_dir + "/managementfile", "a") as file:
        file.write(timestamp)

print(
    "@event=[SUMMA_RESOURCES_DOWNLOADED:downloaded resources from Hydroshare for SUMMA]"
)

# Unzip model file
content_folder = os.path.join(
    download_dir, "{}/{}/data/contents".format(resource_id, resource_id)
)
model_folder_name = "SummaModel_ReynoldsAspenStand_StomatalResistance_sopron"
file_manger_rel_path = "settings/summa_fileManager_riparianAspenSimpleResistance.txt"
workspace_dir = os.path.join(base_dir, "workspace")
subprocess.run(["mkdir", "-p", workspace_dir])
unzip_dir = workspace_dir
model_source_folder_path = os.path.join(unzip_dir, model_folder_name)
if not os.path.exists(
    workspace_dir + "/" + model_folder_name + "/installTestCases_local.sh"
):
    subprocess.run(
        ["unzip", "-o", model_folder_name + ".zip", "-d", unzip_dir], cwd=content_folder
    )

    print(
        "@event=[SUMMA_RESOURCES_UNZIPPED:decompressed resources from Hydroshare for SUMMA]"
    )

# Init
subprocess.run(
    ["chmod", "-x", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

subprocess.run(
    ["chmod", "755", "./installTestCases_local.sh"], cwd=model_source_folder_path,
)

name = os.path.join(
    model_source_folder_path, "settings/summa_zParamTrial_riparianAspen.nc"
)
param_trial = nc.Dataset(name, "w", format="NETCDF3_CLASSIC")
param_trial.createDimension("hru", 1)
param_trial.close()

# create ensemble
# different parameterizations
decision_options = {"stomResist": ["BallBerry", "Jarvis", "simpleResistance"]}
# different parameters
param_options = {
    "rootDistExp": safe_arange(0.01, 1.00, 0.20),
    "summerLAI": safe_arange(0.01, 10.00, 2.00),
}

config = ensemble.total_product(dec_conf=decision_options, param_conf=param_options)

# save ensemble info to json files
params = {}
params["model"] = "summa"
params["model_source_folder_path"] = model_source_folder_path
params["file_manger_rel_path"] = file_manger_rel_path
params["workspace_dir"] = workspace_dir
params["machine"] = "keeling"
params["node"] = 16
params["walltime"] = 1

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
