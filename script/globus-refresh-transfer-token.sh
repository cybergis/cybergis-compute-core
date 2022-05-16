#!/bin/bash
docker-compose -f ./docker/docker-compose.yml run job_supervisor node /job_supervisor/production/tools/globus-refresh-transfer-token.js "$@"