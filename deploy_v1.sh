#!/bin/bash

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

export GLOBUS_CLIENT_ID=cc05ae63-8cd8-43de-8721-0eee914c423b
export GLOBUS_TRANSFER_REFRESH_TOKEN=Ag89GJlrYKzeWd3W0yk8brbzKmPBXpGadlrqqpB3x28NJMY3edfaU5WMxDrGPQaWgDx4jBKwM5kEXoV3GJr4Klp6QqEy0
export GLOBUS_SOURCE_ENDPOINT_ID=b256c034-1578-11eb-893e-0a5521ff3f4b
export GLOBUS_DESTINATION_ENDPOINT_ID=fcd5acc6-157f-11ec-90b8-41052087bc27

node ./cli.js serve

# Linux: access host port from within container
# host firewall: ufw allow from 172.0.0.0/8 to any port 3000
# For docker >= 20.10
# https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal/67158212#67158212#
