FROM python:3.6-alpine
RUN set -ex; \
    apk add --update --no-cache \
    bash nettle iptables redis dumb-init openrc tzdata pkgconfig build-base libffi-dev
RUN pip install ipython --upgrade -i https://pypi.tuna.tsinghua.edu.cn/simple