FROM node:16.2.0-alpine3.13
RUN set -ex; \
    apk add --update --no-cache \
    bash nettle iptables redis dumb-init openrc \
    python3 python3-dev tzdata pkgconfig build-base \
    git libgit2-dev krb5-dev py-pip py-cryptography openssh
RUN python3 -m pip install globus_sdk
RUN set -xe; \
    apk add --no-cache openconnect -X http://dl-cdn.alpinelinux.org/alpine/edge/community
EXPOSE 3030
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/job_supervisor/docker-entrypoint.sh"]
