#!/usr/bin/dumb-init /bin/sh

# openconnect
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

# mysql
if [ ! -d "/run/mysqld" ]; then
  mkdir -p /run/mysqld
fi

if [ -d /app/mysql ]; then
  echo "[i] MySQL directory already present, skipping creation"
else
  echo "[i] MySQL data directory not found, creating initial DBs"

  mysql_install_db --user=root > /dev/null

  if [ "$MYSQL_ROOT_PASSWORD" = "" ]; then
    MYSQL_ROOT_PASSWORD=111111
    echo "[i] MySQL root Password: $MYSQL_ROOT_PASSWORD"
  fi

  MYSQL_DATABASE=${MYSQL_DATABASE:-""}
  MYSQL_USER=${MYSQL_USER:-""}
  MYSQL_PASSWORD=${MYSQL_PASSWORD:-""}

  tfile=`mktemp`
  if [ ! -f "$tfile" ]; then
      return 1
  fi

  cat << EOF > $tfile
USE mysql;
FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY "$MYSQL_ROOT_PASSWORD" WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
EOF

  if [ "$MYSQL_DATABASE" != "" ]; then
    echo "[i] Creating database: $MYSQL_DATABASE"
    echo "CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\` CHARACTER SET utf8 COLLATE utf8_general_ci;" >> $tfile

    if [ "$MYSQL_USER" != "" ]; then
      echo "[i] Creating user: $MYSQL_USER with password $MYSQL_PASSWORD"
      echo "GRANT ALL ON \`$MYSQL_DATABASE\`.* to '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';" >> $tfile
    fi
  fi

  /usr/bin/mysqld --user=root --bootstrap --verbose=0 < $tfile
  rm -f $tfile
fi

# install necessary packages
npm install -g typescript
cd /job_supervisor && npm install

# compile TypeScript
cd /job_supervisor && npm run build

# run server
redis-server /job_supervisor/redis.conf --daemonize yes
node /job_supervisor/production/server.js