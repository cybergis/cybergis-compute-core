from globus_sdk import NativeAppAuthClient
import sys

CLIENT_ID = str(sys.argv[1])

def output(k, i):
    print('@' + k + '=[' + i + ']')

client = NativeAppAuthClient(CLIENT_ID)
authorize_url = client.oauth2_start_flow()
output('auth_url', authorize_url)