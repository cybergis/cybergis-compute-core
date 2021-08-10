import uuid
from globus_sdk import NativeAppAuthClient, RefreshTokenAuthorizer, TransferClient

CLIENT_ID = str(sys.argv[1])
SOURCE_TRANSFER_REFRESH_TOKEN = str(sys.argv[2])
SOURCE_PATH = str(sys.argv[4])
DESTINATION_IDENTITY = str(sys.argv[3])

client = NativeAppAuthClient(CLIENT_ID)
authorizer = RefreshTokenAuthorizer(TRANSFER_REFRESH_TOKEN, client)
transfer_client = TransferClient(authorizer=authorizer)

transfer_client.add_endpoint_acl_rule(endpoint_id, {
    "DATA_TYPE": "access",
    "permission": "rw",
    "path": SOURCE_PATH,
    "principal_type": "identity",
    "principal": DESTINATION_IDENTITY
})