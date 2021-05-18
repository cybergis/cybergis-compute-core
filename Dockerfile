FROM node:14-alpine
WORKDIR /job_supervisor
RUN set -ex; \
    apk add --update --no-cache \
    bash python3
EXPOSE 3000
ENTRYPOINT ["/job_supervisor/docker-entrypoint.sh"]
