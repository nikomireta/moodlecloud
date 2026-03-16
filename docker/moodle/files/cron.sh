#!/bin/sh
set -eu

/usr/local/bin/render-config.sh

MOODLE_CRON_INTERVAL="${MOODLE_CRON_INTERVAL:-60}"
MOODLE_CRON_HEARTBEAT="${MOODLE_CRON_HEARTBEAT:-/tmp/moodle-cron.last-run}"
sleep "${MOODLE_CRON_START_DELAY:-30}"

while true; do
  if su -s /bin/sh www-data -c "php /var/www/html/admin/cli/cron.php --keep-alive=0"; then
    touch "$MOODLE_CRON_HEARTBEAT"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] moodle cron execution failed" >&2
  fi
  sleep "$MOODLE_CRON_INTERVAL"
done
