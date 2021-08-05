#!/bin/bash
docker-compose -f ./docker-compose.yml run job_supervisor node /job_supervisor/production/cli.js "$@"