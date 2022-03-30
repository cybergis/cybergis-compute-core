# Compute V1 is non-dockerized 
# dependes on conda env "jobsupdev_v1"
# runs at port 3000 on host directly
# proxied by dockerized nginx container at url /
# must allow nginx container to access port 3000 on host
# see below: access host port from within container


source /opt/miniconda3/bin/activate

conda activate jobsupdev_v1


redis-server --daemonize yes
# to stop: redis-cli shutdown

node ./cli.js background stop-all

node ./cli.js serve

# Linux: access host port from within container
# host firewall: ufw allow from 172.0.0.0/8 to any port 3000
# For docker >= 20.10
# https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal/67158212#67158212#
