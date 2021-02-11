import sys
import os
from cybergis import SummaSupervisorToHPC

machine = str(sys.argv[1])
username = str(sys.argv[2])
key_path = str(sys.argv[3])
remote_id = str(sys.argv[4])
remote_model_folder_path = str(sys.argv[5])
local_job_folder_path = str(sys.argv[6])
s = SummaSupervisorToHPC({"machine": machine}, username, key_path)

s = s.connect()

status = s.job_status(remote_id)

if status == "C" or status == "UNKNOWN":
    s.download(
        os.path.join(remote_model_folder_path, "model/output"), local_job_folder_path
    )
    print('@custom_downloaded_path=[' + os.path.join(local_job_folder_path, "output") + ']')
    print("@event=[JOB_ENDED:RHESSys job with remote_id " + remote_id + " completed]")
elif status == "ERROR":
    print("@event=[JOB_FAILED:RHESSys job with remote_id " + remote_id + " failed]")
