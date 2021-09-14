import os
import sys
import json

## Setup Globus Connect Personal on JetStream NFS VM
## see: https://docs.globus.org/how-to/globus-connect-personal-linux/

## see: https://globus-sdk-python.readthedocs.io/en/stable/examples/advanced_transfer.html

import logging
from globus_sdk import GlobusAPIError, NetworkError

# putting logger objects named by the module name into the module-level
# scope is a common best practice -- for more details, you should look
# into the python logging documentation
logger = logging.getLogger(__name__)


def retry_globus_function(func, retries=5, func_name="<func>"):
    """
    Define what it means to retry a "Globus Function", some function or
    method which produces Globus SDK errors on failure.
    """

    def actually_retry():
        """
        Helper: run the next retry
        """
        return retry_globus_function(func, retries=(retries - 1), func_name=func_name)

    def check_for_reraise():
        """
        Helper: check if we should reraise an error
                logs an error message on reraise
                must be run inside an exception handler
        """
        if retries < 1:
            logger.error("Retried {} too many times.".format(func_name))
            raise

    try:
        return func()
    except NetworkError:
        # log with exc_info=True to capture a full stacktrace as a
        # debug-level log
        logger.debug(
            ("Globus func {} experienced a network error".format(func_name)),
            exc_info=True,
        )
        check_for_reraise()
    except GlobusAPIError:
        # again, log with exc_info=True to capture a full stacktrace
        logger.warning(
            ("Globus func {} experienced a network error".format(func_name)),
            exc_info=True,
        )
        check_for_reraise()

    # if we reach this point without returning or erroring, retry
    return actually_retry()


def submit_transfer_with_retries(transfer_client, transfer_data):
    # create a function with no arguments, for our retry handler
    def locally_bound_func():
        return transfer_client.submit_transfer(transfer_data)

    return retry_globus_function(locally_bound_func, func_name="submit_transfer")


# Connect to HydroShare
job_id = str(sys.argv[1])
upload_dir = str(sys.argv[2])


json_path = os.path.join(upload_dir, "globus.json")
with open(json_path) as f:
    globus_json = json.load(f)
hpc = globus_json.get("hpc", "expanse")
jupyter_user = globus_json.get("jupyter_user", None)
job_folder_name = globus_json.get("job_folder_name", None)
jupyter_output_path = globus_json.get("jupyter_output_path", None)

import globus_sdk

CLIENT_ID = os.environ["GLOBUS_CLIENT_ID"]

client = globus_sdk.NativeAppAuthClient(CLIENT_ID)
transfer_rt = os.environ["GLOBUS_TRANSFER_REFRESH_TOKEN"]
authorizer = globus_sdk.RefreshTokenAuthorizer(
    transfer_rt, client,
)
tc = globus_sdk.TransferClient(authorizer=authorizer)

# expanse
source_endpoint_id = os.environ["GLOBUS_SOURCE_ENDPOINT_ID"]
# cjw NFS
destination_endpoint_id = os.environ["GLOBUS_DESTINATION_ENDPOINT_ID"]

globus_task_label = "{}_{}_{}_{}".format(job_id, hpc, jupyter_user, job_folder_name)
tdata = globus_sdk.TransferData(tc, source_endpoint_id,
                                 destination_endpoint_id,
                                 label=globus_task_label,
                                 sync_level="checksum")
expanse_root = "/expanse/lustre/scratch/cybergis/temp_project"
source_path = os.path.join(expanse_root, job_folder_name)

target_root = "/~/mnt/nfs_folder/notebook_home_data"
target_path = os.path.join(target_root, jupyter_user, jupyter_output_path)

tdata.add_item(source_path,
               target_path,
               recursive=True)
transfer_result = submit_transfer_with_retries(tc, tdata)
globus_task_id = transfer_result["task_id"]

print("@event=[JOB_INITIALIZED: {} (Globus task id {}; label {})]".format(job_id, globus_task_id, globus_task_label))
out = {"globus_task_id": globus_task_id, "globus_task_label": globus_task_label}
for i in out.keys():
    print("@var=[" + i + ":" + out[i] + "]")
