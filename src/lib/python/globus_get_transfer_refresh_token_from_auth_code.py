from globus_sdk import NativeAppAuthClient
import sys

CLIENT_ID = str(sys.argv[1])
AUTH_CODE = str(sys.argv[2])

def output(k, i):
    print('@' + k + '=[' + i + ']')

client = NativeAppAuthClient(CLIENT_ID)
token_response = client.oauth2_exchange_code_for_tokens(AUTH_CODE)

globus_auth_data = token_response.by_resource_server["auth.globus.org"]
globus_transfer_data = token_response.by_resource_server["transfer.api.globus.org"]

output('transfer_refresh_token', globus_transfer_data['refresh_token'])