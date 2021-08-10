from globus_sdk import NativeAppAuthClient

CLIENT_ID = str(sys.argv[1])

def output(k, i):
    print('@' + k + '=[' + i + ']')

client = NativeAppAuthClient(CLIENT_ID)
token_response = client.oauth2_exchange_code_for_tokens(CLIENT_AUTH_CODE)

globus_auth_data = token_response.by_resource_server["auth.globus.org"]
globus_transfer_data = token_response.by_resource_server["transfer.api.globus.org"]

output('source_transfer_refresh_token', globus_transfer_data['refresh_token'])