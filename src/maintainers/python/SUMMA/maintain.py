import sys
from cybergis import SummaSupervisorToHPC

machine = str(sys.argv[1])
username = str(sys.argv[2])
key_path = str(sys.argv[3])
remote_id = str(sys.argv[4])
remote_slurm_out_file_path = str(sys.argv[5])
remote_model_folder_path = str(sys.argv[6])
local_job_folder_path = str(sys.argv[7])
s = SummaSupervisorToHPC({
    machine: machine
}, username, key_path)

s = s.connect()

status = s.job_status(remote_id)
print(remote_model_folder_path, remote_slurm_out_file_path, local_job_folder_path)

if status == 'C' or status == 'UNKNOWN':
    s.download(remote_model_folder_path, remote_slurm_out_file_path, local_job_folder_path)
    print('@event=[JOB_ENDED:SUMMA job with remote_id ' + remote_id + ' completed]')
elif status == 'ERROR':
    print('@event=[JOB_FAILED: SUMMA job with remote_id ' + remote_id + ' failed]')