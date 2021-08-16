#!/bin/bash
docker-compose -f ./docker-compose.yml stop
echo "running server in background..."
docker-compose -f ./docker-compose.yml up -d
