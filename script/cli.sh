#!/bin/bash
docker-compose -f ./docker-compose.yml --log-level ERROR run job_supervisor node /job_supervisor/production/cli.js "$@"