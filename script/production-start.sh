#!/bin/bash
echo "running server in background..."
docker-compose -f ./docker-compose.yml up -d
