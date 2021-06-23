#!/bin/bash
echo "running MySQL..."
docker-compose -f ./docker-compose.yml up --remove-orphans db adminer
