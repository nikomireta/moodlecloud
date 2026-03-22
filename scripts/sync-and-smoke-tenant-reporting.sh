#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC_SCRIPT="$ROOT_DIR/docker/moodle/scripts/sync-local-report-plugin.sh"
SMOKE_SCRIPT="$ROOT_DIR/scripts/smoke-tenant-reporting.sh"

SUBDOMAIN=""
MOODLE_ADMIN_USER="${MOODLE_ADMIN_USER:-}"
MOODLE_ADMIN_PASSWORD="${MOODLE_ADMIN_PASSWORD:-}"
APP_BASE_URL="${APP_BASE_URL:-}"
MOODLE_BASE_URL="${MOODLE_BASE_URL:-}"
PERIOD_KEY="${PERIOD_KEY:-}"
EMAIL="${PLAYWRIGHT_SEED_EMAIL:-}"
PASSWORD="${PLAYWRIGHT_SEED_PASSWORD:-}"
KEEP_BROWSER="false"
SKIP_SYNC="false"
SYNC_MODE="fragment"
WEB_CONTAINER=""
CRON_CONTAINER=""

usage() {
  cat <<'EOF'
Usage:
  sync-and-smoke-tenant-reporting.sh <subdomain> [options]

Options:
  --web <container>               Optional explicit web container for sync
  --cron <container>              Optional explicit cron container for sync
  --app-base-url <url>            Forwarded to the smoke test helper
  --moodle-base-url <url>         Forwarded to the smoke test helper
  --email <email>                 Forwarded to the smoke test helper
  --password <password>           Forwarded to the smoke test helper
  --period-key <period_key>       Forwarded to the smoke test helper
  --moodle-admin-user <user>      Optional Moodle admin username for connector-page smoke
  --moodle-admin-password <pass>  Optional Moodle admin password for connector-page smoke
  --keep-browser                  Leave the Playwright session open after smoke
  --skip-sync                     Run only the smoke test without syncing the plugin

Examples:
  ./scripts/sync-and-smoke-tenant-reporting.sh 4r4r4
  ./scripts/sync-and-smoke-tenant-reporting.sh 4r4r4 --moodle-admin-user admin --moodle-admin-password 'secret'
  ./scripts/sync-and-smoke-tenant-reporting.sh 4r4r4 --web mc-web-4r4r4-89d62d3f --cron mc-cron-4r4r4-89d62d3f
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --web)
        WEB_CONTAINER="$2"
        SYNC_MODE="containers"
        shift 2
        ;;
      --cron)
        CRON_CONTAINER="$2"
        SYNC_MODE="containers"
        shift 2
        ;;
      --app-base-url)
        APP_BASE_URL="$2"
        shift 2
        ;;
      --moodle-base-url)
        MOODLE_BASE_URL="$2"
        shift 2
        ;;
      --email)
        EMAIL="$2"
        shift 2
        ;;
      --password)
        PASSWORD="$2"
        shift 2
        ;;
      --period-key)
        PERIOD_KEY="$2"
        shift 2
        ;;
      --moodle-admin-user)
        MOODLE_ADMIN_USER="$2"
        shift 2
        ;;
      --moodle-admin-password)
        MOODLE_ADMIN_PASSWORD="$2"
        shift 2
        ;;
      --keep-browser)
        KEEP_BROWSER="true"
        shift
        ;;
      --skip-sync)
        SKIP_SYNC="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      -*)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
      *)
        if [[ -n "$SUBDOMAIN" ]]; then
          echo "Only one subdomain may be provided." >&2
          usage >&2
          exit 1
        fi
        SUBDOMAIN="$1"
        shift
        ;;
    esac
  done

  if [[ -z "$SUBDOMAIN" ]]; then
    usage >&2
    exit 1
  fi

  if [[ "$SYNC_MODE" == "containers" ]]; then
    if [[ -z "$WEB_CONTAINER" || -z "$CRON_CONTAINER" ]]; then
      echo "Both --web and --cron are required when specifying explicit containers." >&2
      exit 1
    fi
  fi

  if [[ -n "$MOODLE_ADMIN_USER" && -z "$MOODLE_ADMIN_PASSWORD" ]]; then
    echo "A Moodle admin password is required when --moodle-admin-user is provided." >&2
    exit 1
  fi
}

build_smoke_args() {
  SMOKE_ARGS=("$SUBDOMAIN")

  if [[ -n "$APP_BASE_URL" ]]; then
    SMOKE_ARGS+=(--app-base-url "$APP_BASE_URL")
  fi
  if [[ -n "$MOODLE_BASE_URL" ]]; then
    SMOKE_ARGS+=(--moodle-base-url "$MOODLE_BASE_URL")
  fi
  if [[ -n "$EMAIL" ]]; then
    SMOKE_ARGS+=(--email "$EMAIL")
  fi
  if [[ -n "$PASSWORD" ]]; then
    SMOKE_ARGS+=(--password "$PASSWORD")
  fi
  if [[ -n "$PERIOD_KEY" ]]; then
    SMOKE_ARGS+=(--period-key "$PERIOD_KEY")
  fi
  if [[ -n "$MOODLE_ADMIN_USER" ]]; then
    SMOKE_ARGS+=(--moodle-admin-user "$MOODLE_ADMIN_USER" --moodle-admin-password "$MOODLE_ADMIN_PASSWORD")
  fi
  if [[ "$KEEP_BROWSER" == "true" ]]; then
    SMOKE_ARGS+=(--keep-browser)
  fi
}

main() {
  parse_args "$@"

  if [[ ! -x "$SMOKE_SCRIPT" ]]; then
    echo "Smoke script is missing or not executable: $SMOKE_SCRIPT" >&2
    exit 1
  fi

  if [[ "$SKIP_SYNC" != "true" ]]; then
    if [[ ! -x "$SYNC_SCRIPT" ]]; then
      echo "Sync script is missing or not executable: $SYNC_SCRIPT" >&2
      exit 1
    fi

    echo "Step 1/2: syncing plugin into tenant runtime..."
    if [[ "$SYNC_MODE" == "containers" ]]; then
      "$SYNC_SCRIPT" --web "$WEB_CONTAINER" --cron "$CRON_CONTAINER"
    else
      "$SYNC_SCRIPT" "$SUBDOMAIN"
    fi
  else
    echo "Skipping runtime sync as requested."
  fi

  build_smoke_args

  echo "Step 2/2: running tenant reporting smoke test..."
  "$SMOKE_SCRIPT" "${SMOKE_ARGS[@]}"
}

main "$@"
