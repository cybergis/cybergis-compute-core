import string
import sys
import logging
import escapism  # need to install by conda or pip

logger = logging.getLogger(__name__)
USER_NAME = str(sys.argv[1])
MAPPING_FUNC = str(sys.argv[2])


def output(k, i):
    print("@" + k + "=[" + i + "]")


def username_mapping_iguide_k8s_js2(in_username):
    username_encoded = escapism.escape(
        in_username,
        escape_char="-",
        safe=set(string.ascii_lowercase + string.digits)
    )
    username_mapped = "iguide-claim-{}".format(username_encoded)
    return username_mapped


if (MAPPING_FUNC == "iguide-mapping"):
  USERNAME_MAPPED = username_mapping_iguide_k8s_js2(USER_NAME)
else:
  USERNAME_MAPPED = USER_NAME
output("mapped_username", USERNAME_MAPPED)
exit()
