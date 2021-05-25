FROM node:16.2.0-alpine3.13
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN set -ex; \
    apk add --update --no-cache \
    bash python3 nettle iptables redis dumb-init
RUN set -xe; \
    apk add --no-cache openconnect -X http://dl-cdn.alpinelinux.org/alpine/edge/community
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/job_supervisor/docker-entrypoint.sh"]
