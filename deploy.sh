#!/bin/bash
docker-compose stop
docker-compose up -d
cd ../cybergis-compute-core-deploy-notes
./start-nginx.sh
