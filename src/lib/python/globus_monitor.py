import sys
import time
from globus_sdk import NativeAppAuthClient, RefreshTokenAuthorizer, TransferClient

def output(k, i):
    print('@' + k + '=[' + i + ']')

CLIENT_ID = str(sys.argv[1])
TRANSFER_REFRESH_TOKEN = str(sys.argv[2])
GLOBUS_TASK_ID = str(sys.argv[3])

client = NativeAppAuthClient(CLIENT_ID)
authorizer = RefreshTokenAuthorizer(TRANSFER_REFRESH_TOKEN, client)
transfer_client = TransferClient(authorizer=authorizer)
res = transfer_client.get_task(GLOBUS_TASK_ID)

while True:
    status = res.data["status"]
    if status == 'SUCCEEDED' or status == 'FAILED':
        output('status', status)
        break
    else:
        time.sleep(1)
        try:
            res = transfer_client.get_task(GLOBUS_TASK_ID)
        except:
            time.sleep(1)

exit()