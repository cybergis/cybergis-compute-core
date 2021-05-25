#!/usr/bin/dumb-init /bin/sh

# Start openconnect
if [[ ! -z "${OPENCONNECT_USER}" ]]; then
  if [[ -z "${OPENCONNECT_PASSWORD}" ]]; then
    # Ask for password
    openconnect -b -u $OPENCONNECT_USER --protocol=anyconnect --authgroup $OPENCONNECT_AUTHGROUP $OPENCONNECT_URL
  elif [[ ! -z "${OPENCONNECT_PASSWORD}" ]] && [[ ! -z "${OPENCONNECT_MFA_CODE}" ]]; then
    # Multi factor authentication (MFA)
    (echo $OPENCONNECT_PASSWORD; echo $OPENCONNECT_MFA_CODE) | openconnect -b -u $OPENCONNECT_USER  --protocol=anyconnect --authgroup $OPENCONNECT_AUTHGROUP --passwd-on-stdin $OPENCONNECT_URL
  elif [[ ! -z "${OPENCONNECT_PASSWORD}" ]]; then
    # Standard authentication
    echo $OPENCONNECT_PASSWORD | openconnect -b -u $OPENCONNECT_USER --protocol=anyconnect --authgroup $OPENCONNECT_AUTHGROUP --passwd-on-stdin $OPENCONNECT_URL
  fi
fi

redis-server /job_supervisor/redis.conf --daemonize yes
node /job_supervisor/production/server.js