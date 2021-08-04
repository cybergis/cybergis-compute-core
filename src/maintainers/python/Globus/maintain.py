import sys
import os
import globus_sdk

job_id = str(sys.argv[1])
globus_task_id = str(sys.argv[2])
globus_task_label = str(sys.argv[3])

CLIENT_ID = os.environ["GLOBUS_CLIENT_ID"]

client = globus_sdk.NativeAppAuthClient(CLIENT_ID)
transfer_rt = os.environ["GLOBUS_TRANSFER_REFRESH_TOKEN"]
authorizer = globus_sdk.RefreshTokenAuthorizer(
    transfer_rt, client,
)
tc = globus_sdk.TransferClient(authorizer=authorizer)
# see: https://github.com/globus/globus-jupyter-notebooks
response = tc.get_task(globus_task_id)
status = response.data["status"]

if status == "SUCCEEDED":
    print("@event=[JOB_ENDED: {} ({} ; {} ; {})]".format(status, job_id, globus_task_id, globus_task_label))
elif status == "FAILED":
    print("@event=[JOB_FAILED: {} ({} ; {} ; {})]".format(status, job_id, globus_task_id, globus_task_label))
else:
    print("@event=[JOB_STATUS: {} ({} ; {} ; {})]".format(status, job_id, globus_task_id, globus_task_label))
