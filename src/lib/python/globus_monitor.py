import os
import sys
import json
import logging
import time
from globus_sdk import NativeAppAuthClient, RefreshTokenAuthorizer, TransferClient

logger = logging.getLogger(__name__)
CLIENT_ID = str(sys.argv[1])
DESTINATION_TRANSFER_REFRESH_TOKEN = str(sys.argv[2])
GLOBUS_TASK_ID = str(sys.argv[3])

client = NativeAppAuthClient(CLIENT_ID)
authorizer = RefreshTokenAuthorizer(DESTINATION_TRANSFER_REFRESH_TOKEN, client)
transfer_client = TransferClient(authorizer=authorizer)
res = transfer_client.get_task(GLOBUS_TASK_ID)

while True:
    status = res.data["status"]
    if status == 'SUCCEEDED' or status == 'FAILED':
        print('@status=[' + status + ']')
        break
    else:
        time.sleep(1)
        res = transfer_client.get_task(GLOBUS_TASK_ID)
