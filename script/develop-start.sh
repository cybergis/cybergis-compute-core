#!/bin/bash
echo "compiling TypeScript..."
npm run build

echo "running redis in background..."
docker-compose -f ./docker-compose.yml up -d redis

echo "running job-supervisor..."
docker-compose -f ./docker-compose.yml up job_supervisor
