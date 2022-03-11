import sys
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

status = res.data["status"]
output('status', status)

exit()