#!/bin/bash
print_usage() {
  echo "-l [OPENCONNECT_URL] -u [OPENCONNECT_USER] -p [OPENCONNECT_PASSWORD] -g [OPENCONNECT_AUTHGROUP]"
}

while getopts 'u:p:g:l:h' flag; do
  case "${flag}" in
    u) export OPENCONNECT_USER="${OPTARG}" ;;
    p) export OPENCONNECT_PASSWORD="${OPTARG}" ;;
    g) export OPENCONNECT_AUTHGROUP="${OPTARG}" ;;
    l) export OPENCONNECT_URL="${OPTARG}" ;;
    h) print_usage
       exit 1 ;;
  esac
done

echo "compiling TypeScript..."
npm run build

echo "running job-supervisor..."
docker-compose -f ./docker-compose.yml up --remove-orphans job_supervisor