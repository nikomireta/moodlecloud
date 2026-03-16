#!/bin/sh
set -eu

MOODLE_DATAROOT="${MOODLE_DATAROOT:-/var/www/moodledata}"
MOODLE_ADMIN_PATH="${MOODLE_ADMIN_PATH:-admin}"
export MOODLE_DB_TYPE="${MOODLE_DB_TYPE:-pgsql}"
export MOODLE_DB_HOST="${MOODLE_DB_HOST:-postgres}"
export MOODLE_DB_PORT="${MOODLE_DB_PORT:-5432}"
export MOODLE_DB_NAME="${MOODLE_DB_NAME:-moodle}"
export MOODLE_DB_USER="${MOODLE_DB_USER:-moodle}"
export MOODLE_DB_PASSWORD="${MOODLE_DB_PASSWORD:-moodle}"
export MOODLE_WWWROOT="${MOODLE_WWWROOT:-http://localhost}"
export MOODLE_DATAROOT
export MOODLE_ADMIN_PATH

mkdir -p "$MOODLE_DATAROOT"
chown -R www-data:www-data "$MOODLE_DATAROOT"
chown www-data:www-data /var/www/html
envsubst '${MOODLE_DB_TYPE} ${MOODLE_DB_HOST} ${MOODLE_DB_PORT} ${MOODLE_DB_NAME} ${MOODLE_DB_USER} ${MOODLE_DB_PASSWORD} ${MOODLE_WWWROOT} ${MOODLE_DATAROOT} ${MOODLE_ADMIN_PATH}' \
  < /opt/moodle/config.php.template \
  > /var/www/html/config.php
chown www-data:www-data /var/www/html/config.php
