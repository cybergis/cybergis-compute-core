#!/bin/bash
docker-compose -f docker-compose.yml_v1_v2_coexisting down
docker-compose -f docker-compose.yml_v1_v2_coexisting up -d
cd ../cybergis-compute-core-deploy-notes
./start-nginx.sh
