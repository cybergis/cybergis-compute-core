#!/bin/bash
docker-compose -f ./docker-compose.yml stop

print_usage() {
  echo "-l [OPENCONNECT_URL] -u [OPENCONNECT_USER] -p [OPENCONNECT_PASSWORD] -g [OPENCONNECT_AUTHGROUP]"
}

while getopts 'u:p:g:l:hb' flag; do
  case "${flag}" in
    u) export OPENCONNECT_USER="${OPTARG}" ;;
    p) export OPENCONNECT_PASSWORD="${OPTARG}" ;;
    g) export OPENCONNECT_AUTHGROUP="${OPTARG}" ;;
    l) export OPENCONNECT_URL="${OPTARG}" ;;
    b) export RUN_IN_BACKGROUND="true";;
    h) print_usage
       exit 1 ;;
  esac
done

echo "running job-supervisor..."
if [[ ! -z "${RUN_IN_BACKGROUND}" ]]; then
  docker-compose -f ./docker-compose.yml up -d --remove-orphans job_supervisor
else
  docker-compose -f ./docker-compose.yml up -d --remove-orphans db
  docker-compose -f ./docker-compose.yml up --remove-orphans job_supervisor
fi
