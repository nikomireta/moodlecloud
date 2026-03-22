#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC_SCRIPT="$ROOT_DIR/docker/moodle/scripts/sync-local-report-plugin.sh"
SMOKE_SCRIPT="$ROOT_DIR/scripts/smoke-tenant-reporting.sh"
BROWSER_SCRIPT="$ROOT_DIR/scripts/report-lab-browser-actions.sh"
HELPER_SCRIPT="$ROOT_DIR/scripts/moodle-report-lab-helper.php"

SUBDOMAIN="${SUBDOMAIN:-freshtrack1773881806}"
COURSE_SHORTNAME="${COURSE_SHORTNAME:-RPTJM_M_20260322}"
COURSE_FULLNAME="${COURSE_FULLNAME:-Reporting JMeter M 2026-03-22}"
COURSE_SIZE="${COURSE_SIZE:-M}"
JMETER_SIZE="${JMETER_SIZE:-M}"
GENERATOR_PASSWORD="${GENERATOR_PASSWORD:-JMeterGen123!}"
BACKEND_DB_URL="${BACKEND_DB_URL:-postgresql://postgres:postgres@localhost:5432/moodlepilot}"
JMETER_BIN="${JMETER_BIN:-/opt/jmeter/bin/jmeter}"

WEB_CONTAINER=""
CRON_CONTAINER=""
SITE_ID=""
OUTPUT_DIR=""
CONTAINER_EXPORT_DIR=""
MANIFEST_PATH=""

usage() {
  cat <<'EOF'
Usage:
  run-report-lab.sh [options]

Options:
  --subdomain <value>            Default: freshtrack1773881806
  --shortname <value>            Default: RPTJM_M_20260322
  --fullname <value>             Default: Reporting JMeter M 2026-03-22
  --course-size <value>          Default: M
  --jmeter-size <value>          Default: M
  --generator-password <value>   Default: JMeterGen123!
  --jmeter-bin <path>            Default: /opt/jmeter/bin/jmeter
  --backend-db-url <url>         Default: postgresql://postgres:postgres@localhost:5432/moodlepilot

This helper:
  1. Syncs the current report plugin to the dedicated tenant
  2. Enables developer debugging and generator-user password
  3. Recreates the lab course with Moodle's official course generator
  4. Generates official JMeter assets and copies them locally
  5. Runs JMeter locally
  6. Runs a real-browser learner pass for heartbeat/session data
  7. Triggers report rollup + ingest and stores before/after snapshot counts
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

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --subdomain)
        SUBDOMAIN="$2"
        shift 2
        ;;
      --shortname)
        COURSE_SHORTNAME="$2"
        shift 2
        ;;
      --fullname)
        COURSE_FULLNAME="$2"
        shift 2
        ;;
      --course-size)
        COURSE_SIZE="$2"
        shift 2
        ;;
      --jmeter-size)
        JMETER_SIZE="$2"
        shift 2
        ;;
      --generator-password)
        GENERATOR_PASSWORD="$2"
        shift 2
        ;;
      --jmeter-bin)
        JMETER_BIN="$2"
        shift 2
        ;;
      --backend-db-url)
        BACKEND_DB_URL="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done
}

find_containers_and_site() {
  WEB_CONTAINER="$(docker ps --format '{{.Names}}' | grep "^mc-web-" | grep "${SUBDOMAIN}" | head -n 1)"
  CRON_CONTAINER="$(docker ps --format '{{.Names}}' | grep "^mc-cron-" | grep "${SUBDOMAIN}" | head -n 1)"
  SITE_ID="$(psql "$BACKEND_DB_URL" -Atc "select id from sites where subdomain='${SUBDOMAIN}'")"

  if [[ -z "$WEB_CONTAINER" || -z "$CRON_CONTAINER" ]]; then
    echo "Could not find tenant containers for ${SUBDOMAIN}." >&2
    exit 1
  fi
  if [[ -z "$SITE_ID" ]]; then
    echo "Could not find site id for ${SUBDOMAIN}." >&2
    exit 1
  fi
}

configure_moodle_runtime() {
  echo "Configuring developer/debug settings on ${WEB_CONTAINER}..."
  docker exec "$WEB_CONTAINER" php /var/www/html/admin/cli/cfg.php --name=debug --set=32767
  docker exec "$WEB_CONTAINER" php /var/www/html/admin/cli/cfg.php --name=debugdisplay --set=1
  docker exec "$WEB_CONTAINER" php /var/www/html/admin/cli/cfg.php --name=enablecompletion --set=1
}

install_generator_password() {
  local tmp_template
  tmp_template="$(mktemp)"
  docker cp "${WEB_CONTAINER}:/opt/moodle/config.php.template" "$tmp_template"

  sed -i "/tool_generator_users_password/d" "$tmp_template"
  awk -v line="\$CFG->tool_generator_users_password = '${GENERATOR_PASSWORD}';" '
    /require_once\(__DIR__ \. '\''\/lib\/setup\.php'\''\);/ && !inserted {
      print line
      inserted = 1
    }
    { print }
    END {
      if (!inserted) {
        print line
      }
    }
  ' "$tmp_template" > "${tmp_template}.new"
  mv "${tmp_template}.new" "$tmp_template"

  docker cp "$tmp_template" "${WEB_CONTAINER}:/opt/moodle/config.php.template"
  docker cp "$tmp_template" "${CRON_CONTAINER}:/opt/moodle/config.php.template"
  rm -f "$tmp_template"

  docker exec --user root "$WEB_CONTAINER" /usr/local/bin/render-config.sh
  docker exec --user root "$CRON_CONTAINER" /usr/local/bin/render-config.sh
}

verify_runtime_setup() {
  echo "Verifying debug/config state..."
  docker exec "$WEB_CONTAINER" php -r '
    define("CLI_SCRIPT", true);
    require "/var/www/html/config.php";
    echo "debug=" . (string)($CFG->debug ?? "") . PHP_EOL;
    echo "debugdisplay=" . (string)($CFG->debugdisplay ?? "") . PHP_EOL;
    echo "enablecompletion=" . (string)get_config("core", "enablecompletion") . PHP_EOL;
    echo "tool_generator_users_password=" . (string)($CFG->tool_generator_users_password ?? "") . PHP_EOL;
  ' | tee "$OUTPUT_DIR/runtime-config.txt"
}

run_scheduled_task() {
  local classname="$1"
  docker exec "$WEB_CONTAINER" php /var/www/html/admin/cli/scheduled_task.php --execute="$classname"
}

write_snapshot_counts() {
  local target="$1"
  psql "$BACKEND_DB_URL" -Atc "
with latest as (
  select *
  from site_report_snapshots
  where site_id='${SITE_ID}'
    and snapshot_key='reports_summary_v1'
    and period_key='last_7_days'
  order by received_at desc
  limit 1
)
select json_build_object(
  'plugin_version', plugin_version,
  'received_at', received_at,
  'assignment_submission_detail', coalesce(jsonb_array_length(payload->'assignment_submission_detail'), 0),
  'forum_engagement_summary', coalesce(jsonb_array_length(payload->'forum_engagement_summary'), 0),
  'gradebook_detail', coalesce(jsonb_array_length(payload->'gradebook_detail'), 0),
  'activity_completion_detail', coalesce(jsonb_array_length(payload->'activity_completion_detail'), 0),
  'quiz_question_analysis', coalesce(jsonb_array_length(payload->'quiz_question_analysis'), 0),
  'daily_trend', coalesce(jsonb_array_length(payload->'daily_trend'), 0),
  'user_activity_summary', coalesce(jsonb_array_length(payload->'user_activity_summary'), 0),
  'activity_stats_summary', coalesce(jsonb_array_length(payload->'activity_stats_summary'), 0),
  'recent_activity', coalesce(jsonb_array_length(payload->'recent_activity'), 0)
)
from latest;
" > "$target"
}

write_connection_status() {
  psql "$BACKEND_DB_URL" -Atc "
select json_build_object(
  'plugin_version', plugin_version,
  'moodle_version', moodle_version,
  'site_url_snapshot', site_url_snapshot,
  'updated_at', updated_at
)
from site_report_connections
where site_id='${SITE_ID}';
" > "$OUTPUT_DIR/connection-status.json"
}

copy_helper_into_container() {
  docker cp "$HELPER_SCRIPT" "${WEB_CONTAINER}:/tmp/moodle-report-lab-helper.php"
}

force_plugin_reconnect() {
  docker exec "$WEB_CONTAINER" php -r '
    define("CLI_SCRIPT", true);
    require "/var/www/html/config.php";
    set_config("manual_force_reconnect", 1, "local_moodlepilot_report");
    set_config("ingest_token", "", "local_moodlepilot_report");
    set_config("ingest_url", "", "local_moodlepilot_report");
  '
}

recreate_lab_course() {
  echo "Deleting previous lab course if it exists..."
  docker exec "$WEB_CONTAINER" php /tmp/moodle-report-lab-helper.php \
    --action=delete-course \
    --shortname="$COURSE_SHORTNAME" | tee "$OUTPUT_DIR/delete-course.json"

  echo "Generating official test course..."
  docker exec "$WEB_CONTAINER" php /var/www/html/public/admin/tool/generator/cli/maketestcourse.php \
    --shortname="$COURSE_SHORTNAME" \
    --fullname="$COURSE_FULLNAME" \
    --size="$COURSE_SIZE" \
    --fixeddataset | tee "$OUTPUT_DIR/maketestcourse.log"
}

generate_jmeter_plan_urls() {
  echo "Validating official JMeter plan generation..."
  docker exec "$WEB_CONTAINER" php /var/www/html/public/admin/tool/generator/cli/maketestplan.php \
    --shortname="$COURSE_SHORTNAME" \
    --size="$JMETER_SIZE" \
    --updateuserspassword | tee "$OUTPUT_DIR/maketestplan.urls.txt"
}

prepare_lab_manifest() {
  echo "Preparing enriched lab data and exporting local JMeter assets..."
  docker exec "$WEB_CONTAINER" php /tmp/moodle-report-lab-helper.php \
    --action=prepare-lab \
    --shortname="$COURSE_SHORTNAME" \
    --size="$JMETER_SIZE" \
    --exportdir="$CONTAINER_EXPORT_DIR" \
    --manifest="$CONTAINER_EXPORT_DIR/manifest.json" | tee "$OUTPUT_DIR/prepare-lab.json"

  rm -rf "$OUTPUT_DIR/assets"
  mkdir -p "$OUTPUT_DIR/assets"
  docker cp "${WEB_CONTAINER}:${CONTAINER_EXPORT_DIR}/." "$OUTPUT_DIR/assets/"
  MANIFEST_PATH="$OUTPUT_DIR/assets/manifest.json"
  cp "$MANIFEST_PATH" "$OUTPUT_DIR/manifest.json"
}

run_jmeter() {
  local jmx_file users_csv
  jmx_file="$(find "$OUTPUT_DIR/assets" -maxdepth 1 -name '*.jmx' | head -n 1)"
  users_csv="$(find "$OUTPUT_DIR/assets" -maxdepth 1 -name '*.csv' | head -n 1)"

  if [[ -z "$jmx_file" || -z "$users_csv" ]]; then
    echo "Missing JMeter assets after prepare step." >&2
    exit 1
  fi

  rm -rf "$OUTPUT_DIR/html-report"

  echo "Running JMeter load..."
  "$JMETER_BIN" \
    -n \
    -t "$jmx_file" \
    -Jusersfile="$users_csv" \
    -l "$OUTPUT_DIR/results.jtl" \
    -j "$OUTPUT_DIR/jmeter.log" \
    -e \
    -o "$OUTPUT_DIR/html-report"
}

run_browser_pass() {
  echo "Running real-browser learner pass for heartbeat/session data..."
  "$BROWSER_SCRIPT" --manifest "$MANIFEST_PATH" --password "$GENERATOR_PASSWORD" | tee "$OUTPUT_DIR/browser-pass.json"
}

write_lab_summary() {
  node - <<'EOF' "$OUTPUT_DIR/before-snapshot.json" "$OUTPUT_DIR/after-snapshot.json" "$OUTPUT_DIR/connection-status.json" "$OUTPUT_DIR/manifest.json" > "$OUTPUT_DIR/lab-summary.json"
const fs = require("fs");
const [beforePath, afterPath, connectionPath, manifestPath] = process.argv.slice(2);
const readJson = (path) => {
  const raw = fs.readFileSync(path, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
};
const summary = {
  before: readJson(beforePath),
  after: readJson(afterPath),
  connection: readJson(connectionPath),
  manifest: readJson(manifestPath),
};
process.stdout.write(JSON.stringify(summary, null, 2));
EOF
}

main() {
  parse_args "$@"

  require_command docker
  require_command psql
  require_command node
  require_command npx

  if [[ ! -x "$SYNC_SCRIPT" || ! -x "$SMOKE_SCRIPT" || ! -x "$BROWSER_SCRIPT" ]]; then
    echo "One or more helper scripts are missing or not executable." >&2
    exit 1
  fi
  if [[ ! -f "$HELPER_SCRIPT" ]]; then
    echo "Missing Moodle helper script: $HELPER_SCRIPT" >&2
    exit 1
  fi
  if [[ ! -x "$JMETER_BIN" ]]; then
    echo "JMeter binary not found or not executable: $JMETER_BIN" >&2
    exit 1
  fi

  find_containers_and_site

  OUTPUT_DIR="$ROOT_DIR/output/jmeter/${SUBDOMAIN}"
  CONTAINER_EXPORT_DIR="/tmp/report-lab-${SUBDOMAIN}"
  rm -rf "$OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"

  echo "Report lab target"
  echo "  tenant        : ${SUBDOMAIN}"
  echo "  site id       : ${SITE_ID}"
  echo "  web container : ${WEB_CONTAINER}"
  echo "  cron container: ${CRON_CONTAINER}"
  echo "  course        : ${COURSE_SHORTNAME}"
  echo "  output        : ${OUTPUT_DIR}"

  write_snapshot_counts "$OUTPUT_DIR/before-snapshot.json"

  echo "Syncing latest report plugin into tenant runtime..."
  "$SYNC_SCRIPT" "$SUBDOMAIN"

  configure_moodle_runtime
  install_generator_password
  verify_runtime_setup
  copy_helper_into_container

  echo "Refreshing registration and baseline ingest..."
  force_plugin_reconnect
  run_scheduled_task 'local_moodlepilot_report\task\bootstrap_registration_task'
  run_scheduled_task 'local_moodlepilot_report\task\report_snapshot_ingest_task'
  write_connection_status

  recreate_lab_course
  generate_jmeter_plan_urls
  prepare_lab_manifest
  run_jmeter
  run_browser_pass

  echo "Running report rollup + ingest after load..."
  run_scheduled_task 'local_moodlepilot_report\task\tracking_rollup_task'
  run_scheduled_task 'local_moodlepilot_report\task\report_snapshot_ingest_task'

  write_snapshot_counts "$OUTPUT_DIR/after-snapshot.json"
  write_connection_status
  write_lab_summary

  echo "Running tenant reporting smoke check..."
  "$SMOKE_SCRIPT" "$SUBDOMAIN" --period-key last_7_days | tee "$OUTPUT_DIR/smoke.log"

  echo "Report lab completed."
}

main "$@"
