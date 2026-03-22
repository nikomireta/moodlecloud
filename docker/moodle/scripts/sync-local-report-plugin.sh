#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PLUGIN_SRC="$ROOT_DIR/docker/moodle/plugins/local/moodlepilot_report"

usage() {
  cat <<'EOF'
Usage:
  sync-local-report-plugin.sh <tenant-fragment>
  sync-local-report-plugin.sh --web <web-container> --cron <cron-container>

Examples:
  sync-local-report-plugin.sh reportplug1773840503
  sync-local-report-plugin.sh --web mc-web-reportplug1773840503-8454e873 --cron mc-cron-reportplug1773840503-8454e873

This helper copies the local Moodlepilot report plugin into both
/var/www/html/local/moodlepilot_report and /var/www/html/public/local/moodlepilot_report
for the selected tenant containers, then runs Moodle upgrade, purges caches,
and restarts the containers.
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

wait_for_container_running() {
  local container="$1"
  local attempts="${2:-60}"
  local delay="${3:-2}"
  local count=0

  while (( count < attempts )); do
    if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" == "true" ]]; then
      return 0
    fi
    sleep "$delay"
    count=$((count + 1))
  done

  echo "Container did not become ready in time: $container" >&2
  exit 1
}

find_container() {
  local prefix="$1"
  local fragment="$2"
  local matches

  matches="$(docker ps --format '{{.Names}}' | grep "^${prefix}" | grep "${fragment}" || true)"
  if [[ -z "$matches" ]]; then
    echo "" >&2
    return 1
  fi

  local count
  count="$(printf '%s\n' "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [[ "$count" != "1" ]]; then
    echo "Expected exactly one ${prefix} container for fragment '${fragment}', found ${count}:" >&2
    printf '  %s\n' $matches >&2
    return 1
  fi

  printf '%s\n' "$matches"
}

copy_into_container() {
  local container="$1"
  local target="$2"

  if docker exec "$container" test -d "$target"; then
    echo "Syncing ${container}:${target}"
    docker cp "$PLUGIN_SRC/." "${container}:${target}/"
  fi
}

main() {
  require_command docker

  local web_container=""
  local cron_container=""

  if [[ $# -eq 1 ]]; then
    web_container="$(find_container 'mc-web-' "$1")"
    cron_container="$(find_container 'mc-cron-' "$1")"
  elif [[ $# -eq 4 && "$1" == "--web" && "$3" == "--cron" ]]; then
    web_container="$2"
    cron_container="$4"
  else
    usage >&2
    exit 1
  fi

  if [[ ! -d "$PLUGIN_SRC" ]]; then
    echo "Plugin source not found: $PLUGIN_SRC" >&2
    exit 1
  fi

  echo "Using web container : $web_container"
  echo "Using cron container: $cron_container"

  wait_for_container_running "$web_container"
  wait_for_container_running "$cron_container"

  for container in "$web_container" "$cron_container"; do
    copy_into_container "$container" /var/www/html/local/moodlepilot_report
    copy_into_container "$container" /var/www/html/public/local/moodlepilot_report
  done

  echo "Running Moodle upgrade and cache purge in $web_container"
  docker exec "$web_container" php /var/www/html/admin/cli/upgrade.php --non-interactive
  docker exec "$web_container" php /var/www/html/admin/cli/purge_caches.php

  echo "Restarting tenant containers"
  docker restart "$web_container" "$cron_container" >/dev/null
  wait_for_container_running "$web_container"
  wait_for_container_running "$cron_container"

  echo "Plugin sync complete."
}

main "$@"
