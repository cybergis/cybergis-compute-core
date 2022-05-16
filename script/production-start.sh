#!/bin/bash
docker-compose -f ./docker/docker-compose.yml stop
echo "running server in background..."
docker-compose -f ./docker/docker-compose.yml up -d
