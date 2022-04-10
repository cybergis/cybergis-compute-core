#!/bin/bash


# As of 2022-04-08
# Compute V1 and V2 are both being used by user notebooks
# V1 run at url /, dockerized
# V2 run at url /v2, dockerized
# both proxied by same nginx container at docker-compose.yml_v1_v2_coexisting
# this script deploys/restarts nginx container and V2

# !!!!DEPERCATED!!!!!
# As of Mar 30, 2022
# Compute V1 and V2 are both being used by user notebooks
# V1 run on host port 3000 at url /, no-dockeried
# V2 run at url /v2, dockerized
# both proxied by same nginx container (nginx container must have access to port 3000 on host)
# this script deploys/restarts nginx container and V2
# To restart V1, go to V1 folder and look for script "deploy_v1.sh" and instructions there

echo "V1 will not get started/restarted by this script! Go to V1 folder and run 'docker-compose up -d' there"

# To deploy/restart V2, give db username and password in docker-compose.yml_v1_v2_coexisting
# ./deploy_v1_v2.sh 

# To add a new model repo to V2 db:
# rm docker-compose.yml
# cp docker-compose.yml_v1_v2_coexisting docker-compose.yml
# /script/cli.sh git add -i hello_world -a https://github.com/cybergis/cybergis-compute-hello-world.git

docker-compose -f docker-compose.yml_v1_v2_coexisting down
docker-compose -f docker-compose.yml_v1_v2_coexisting up -d
