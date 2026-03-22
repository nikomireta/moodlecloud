#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/output/playwright"

APP_BASE_URL="${APP_BASE_URL:-http://localhost:3000}"
PLAYWRIGHT_SEED_EMAIL="${PLAYWRIGHT_SEED_EMAIL:-playwright@example.com}"
PLAYWRIGHT_SEED_PASSWORD="${PLAYWRIGHT_SEED_PASSWORD:-Playwright123!}"
PERIOD_KEY="${PERIOD_KEY:-last_7_days}"

SUBDOMAIN=""
MOODLE_BASE_URL=""
MOODLE_ADMIN_USER="${MOODLE_ADMIN_USER:-}"
MOODLE_ADMIN_PASSWORD="${MOODLE_ADMIN_PASSWORD:-}"
KEEP_BROWSER="false"

usage() {
  cat <<'EOF'
Usage:
  smoke-tenant-reporting.sh <subdomain> [options]

Options:
  --app-base-url <url>            Default: http://localhost:3000
  --moodle-base-url <url>         Default: http://<subdomain>.lvh.me
  --email <email>                 Default: playwright@example.com
  --password <password>           Default: Playwright123!
  --period-key <period_key>       Default: last_7_days
  --moodle-admin-user <user>      Optional Moodle admin username
  --moodle-admin-password <pass>  Optional Moodle admin password
  --keep-browser                  Leave the Playwright browser session open

Checks:
  1. App login works with the seeded user
  2. /situs/<subdomain>?tab=laporan renders the summary report surface
  3. /situs/<subdomain>/laporan renders the tenant overview report
  4. /situs/<subdomain>/laporan/detail renders a paginated detail surface
  5. Guest access to Moodle connector page redirects to login
  6. If Moodle admin credentials are provided, the admin connector page renders
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

json_quote() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

close_session() {
  if [[ "${KEEP_BROWSER}" == "true" ]]; then
    return
  fi

  if [[ -n "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
    "$PWCLI" close >/dev/null 2>&1 || true
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-base-url)
        APP_BASE_URL="$2"
        shift 2
        ;;
      --moodle-base-url)
        MOODLE_BASE_URL="$2"
        shift 2
        ;;
      --email)
        PLAYWRIGHT_SEED_EMAIL="$2"
        shift 2
        ;;
      --password)
        PLAYWRIGHT_SEED_PASSWORD="$2"
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

  if [[ -z "$MOODLE_BASE_URL" ]]; then
    MOODLE_BASE_URL="http://${SUBDOMAIN}.lvh.me"
  fi

  if [[ -n "$MOODLE_ADMIN_USER" && -z "$MOODLE_ADMIN_PASSWORD" ]]; then
    echo "A Moodle admin password is required when --moodle-admin-user is provided." >&2
    exit 1
  fi
}

check_moodle_guest_redirect() {
  local headers
  local status
  local location

  echo "Checking guest redirect on Moodle connector page..."
  headers="$(curl -I -sS "${MOODLE_BASE_URL}/local/moodlepilot_report/index.php")"
  status="$(printf '%s\n' "$headers" | awk 'NR==1 {print $2}')"
  location="$(printf '%s\n' "$headers" | awk 'BEGIN {IGNORECASE=1} /^Location:/ {sub(/\r$/, "", $2); print $2}')"

  if [[ "$status" != "303" ]]; then
    echo "Expected guest redirect HTTP 303 from Moodle connector page, got: ${status}" >&2
    exit 1
  fi

  if [[ "$location" != *"/login/index.php"* ]]; then
    echo "Expected guest redirect to Moodle login, got: ${location}" >&2
    exit 1
  fi

  echo "Guest redirect OK: ${location}"
}

run_app_and_optional_moodle_checks() {
  local app_base_url_js
  local subdomain_js
  local email_js
  local password_js
  local period_key_js
  local moodle_base_url_js
  local moodle_admin_user_js
  local moodle_admin_password_js
  local check_moodle_admin_js
  local code

  app_base_url_js="$(json_quote "$APP_BASE_URL")"
  subdomain_js="$(json_quote "$SUBDOMAIN")"
  email_js="$(json_quote "$PLAYWRIGHT_SEED_EMAIL")"
  password_js="$(json_quote "$PLAYWRIGHT_SEED_PASSWORD")"
  period_key_js="$(json_quote "$PERIOD_KEY")"
  moodle_base_url_js="$(json_quote "$MOODLE_BASE_URL")"
  moodle_admin_user_js="$(json_quote "$MOODLE_ADMIN_USER")"
  moodle_admin_password_js="$(json_quote "$MOODLE_ADMIN_PASSWORD")"
  check_moodle_admin_js="false"
  if [[ -n "$MOODLE_ADMIN_USER" && -n "$MOODLE_ADMIN_PASSWORD" ]]; then
    check_moodle_admin_js="true"
  fi

  code="$(cat <<EOF
async (page) => {
  const appBaseUrl = ${app_base_url_js};
  const subdomain = ${subdomain_js};
  const email = ${email_js};
  const password = ${password_js};
  const periodKey = ${period_key_js};
  const moodleBaseUrl = ${moodle_base_url_js};
  const moodleAdminUser = ${moodle_admin_user_js};
  const moodleAdminPassword = ${moodle_admin_password_js};
  const checkMoodleAdmin = ${check_moodle_admin_js};
  const periodLabels = {
    today: "Hari Ini",
    last_7_days: "7 Hari Terakhir",
    last_30_days: "30 Hari Terakhir",
    this_month: "Bulan Ini",
    last_month: "Bulan Lalu",
  };

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };

  const waitForText = async (textOrRegex, timeout = 20000) => {
    await page.getByText(textOrRegex).first().waitFor({ state: "visible", timeout });
  };

  const waitForUrlPart = async (fragment, timeout = 20000) => {
    await page.waitForFunction(
      (expected) => window.location.href.includes(expected),
      fragment,
      { timeout }
    );
  };

  const applySummaryPeriod = async () => {
    if (periodKey === "last_7_days") {
      return;
    }

    const label = periodLabels[periodKey];
    assert(Boolean(label), "Unknown period key for smoke test: " + periodKey);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: label }).click();
    await waitForText("Prioritas Saat Ini", 20000);
  };

  await page.goto(appBaseUrl + "/masuk", { waitUntil: "domcontentloaded" });
  if (!/\\/dashboard(?:\\?|$)/.test(page.url())) {
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("textbox", { name: "Kata Sandi" }).fill(password);
    await Promise.all([
      page.waitForURL(/\\/dashboard(?:\\?|$)/, { timeout: 20000, waitUntil: "commit" }),
      page.getByRole("button", { name: "Masuk" }).click(),
    ]);
  }
  await page.getByRole("heading", { name: "Situs Moodle Saya" }).waitFor({ state: "visible", timeout: 20000 });

  const siteDetailUrl = appBaseUrl + "/situs/" + subdomain;
  await page.goto(siteDetailUrl, { waitUntil: "domcontentloaded" });
  await waitForText("Status Utama Situs", 20000);
  await waitForText("Status Layanan", 20000);
  await waitForText("Yang Perlu Dicek", 20000);
  await waitForText("Akses & Sistem", 20000);
  await waitForText("Info Teknis", 20000);
  await waitForText(/Plugin laporan:/, 20000);

  const siteSummaryText = await page.locator("body").textContent();
  for (const label of ["Storage", "Pengguna Aktif", "Status Layanan"]) {
    assert(siteSummaryText.includes(label), "Site summary tab is missing control-tower item: " + label);
  }
  await page.getByRole("button", { name: /Info Teknis/i }).click();
  await waitForText("Versi Plugin Laporan", 20000);

  await page.getByRole("tab", { name: "Laporan" }).click();
  await waitForUrlPart("?tab=laporan", 20000);
  const summaryUrl = page.url();
  await page.getByRole("heading", { name: "Ringkasan Laporan" }).waitFor({ state: "visible", timeout: 20000 });
  await applySummaryPeriod();
  await page.getByRole("link", { name: "Buka Laporan Lengkap" }).waitFor({ state: "visible", timeout: 20000 });
  await waitForText("Prioritas Saat Ini", 20000);
  await waitForText("Tren Aktivitas", 20000);
  await waitForText("Yang Perlu Dicek", 20000);
  await waitForText("Status Data", 20000);

  const summaryText = await page.locator("body").textContent();
  assert(summaryText.includes("Buka Laporan Lengkap"), "Summary report page is missing the full report entry link.");
  assert(summaryText.includes("Prioritas Saat Ini"), "Summary report page is missing the report highlight card.");
  assert(summaryText.includes("Status Data"), "Summary report page is missing the diagnostics panel trigger.");
  assert(!summaryText.includes("Fokus Insight"), "Summary report page still shows the legacy insight switcher.");
  for (const cardTitle of ["Peserta perlu perhatian", "Tugas perlu tindak lanjut", "Kursus perlu dipantau"]) {
    assert(summaryText.includes(cardTitle), "Summary report page is missing compact action card: " + cardTitle);
  }
  const detailLinkCount = await page.getByRole("link", { name: /^Lihat detail /i }).count();
  assert(detailLinkCount === 3, "Summary report page should expose exactly 3 compact detail links, got: " + detailLinkCount);
  const diagnosticsTrigger = page.getByRole("button", { name: /Status Data/i });
  const diagnosticsExpanded = await diagnosticsTrigger.getAttribute("aria-expanded");
  assert(diagnosticsExpanded === "false" || diagnosticsExpanded === "true", "Status Data accordion should expose a valid expanded state.");
  if (diagnosticsExpanded === "false") {
    assert(true, "Status Data is collapsed for a healthy tenant summary view.");
  } else {
    await waitForText("Status sinkronisasi", 20000);
    await waitForText("Pelacakan browser", 20000);
  }

  await page.getByRole("link", { name: "Lihat detail Peserta perlu perhatian" }).click();
  await waitForUrlPart("/laporan/detail?period_key=" + periodKey + "&section=at-risk-users", 20000);
  await waitForText("Detail operasional", 20000);

  await page.goto(summaryUrl, { waitUntil: "domcontentloaded" });
  await applySummaryPeriod();
  await waitForText("Yang Perlu Dicek", 20000);
  await page.getByRole("link", { name: "Lihat detail Tugas perlu tindak lanjut" }).click();
  await waitForUrlPart("/laporan/detail?period_key=" + periodKey + "&section=assignment-submission-detail", 20000);
  await waitForText("Detail operasional", 20000);

  const fullUrl = appBaseUrl + "/situs/" + subdomain + "/laporan?period_key=" + periodKey;
  await page.goto(fullUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Laporan Tenant" }).waitFor({ state: "visible", timeout: 20000 });
  await waitForText(/Data diperbarui/, 20000);
  await waitForText(/Pelacakan browser/, 20000);
  await waitForText("Prioritas Saat Ini", 20000);
  await waitForText("Tren Aktivitas Harian", 20000);
  await waitForText("Progres Per Kursus", 20000);
  await waitForText("Fokus Insight", 20000);
  await waitForText("Detail Operasional", 20000);
  await waitForText("Status Data & Diagnostik", 20000);

  const fullText = await page.locator("body").textContent();
  for (const sectionName of ["Orang", "Tugas", "Kursus", "Engagement", "Aktivitas Pengguna", "Detail Nilai", "Penyelesaian Aktivitas", "Aktivitas Quiz", "Aktivitas Terbaru"]) {
    assert(fullText.includes(sectionName), "Full report page is missing section: " + sectionName);
  }
  await waitForText("Tugas Perlu Tindak Lanjut", 20000);
  await page.getByRole("tab", { name: "Orang" }).click();
  await waitForUrlPart("insight=people", 20000);
  await waitForText("Distribusi Status Peserta", 20000);
  assert(/insight=people/.test(page.url()), "Full report page did not update the URL for the people insight tab.");
  await page.getByRole("tab", { name: "Kursus" }).click();
  await waitForUrlPart("insight=courses", 20000);
  await waitForText("Aktivitas Terpadat", 20000);
  assert(/insight=courses/.test(page.url()), "Full report page did not update the URL for the courses insight tab.");
  await page.getByRole("tab", { name: "Engagement" }).click();
  await waitForUrlPart("insight=engagement", 20000);
  await waitForText("Percakapan Forum", 20000);
  assert(/insight=engagement/.test(page.url()), "Full report page did not update the URL for the engagement insight tab.");

  const detailUrl = appBaseUrl + "/situs/" + subdomain + "/laporan/detail?period_key=" + periodKey + "&section=gradebook-detail&insight=engagement";
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await waitForText("Detail operasional", 20000);
  await waitForText(/Total baris/, 20000);
  await page.getByRole("button", { name: "Export CSV" }).waitFor({ state: "visible", timeout: 20000 });
  await page.getByRole("link", { name: "Kembali ke Overview Laporan" }).click();
  await waitForUrlPart("insight=engagement", 20000);
  assert(/insight=engagement/.test(page.url()), "Back navigation from detail did not preserve the active insight.");

  if (checkMoodleAdmin) {
    await page.goto(moodleBaseUrl + "/login/index.php", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: /Username/i }).fill(moodleAdminUser);
    await page.getByRole("textbox", { name: /Password/i }).fill(moodleAdminPassword);
    await Promise.all([
      page.waitForURL(/\\/my\\/?(?:\\?|$)/, { timeout: 20000 }),
      page.getByRole("button", { name: /Log in/i }).click(),
    ]);

    await page.goto(moodleBaseUrl + "/local/moodlepilot_report/index.php", { waitUntil: "domcontentloaded" });
    await waitForText("Moodlepilot report connector status", 20000);
  }

  return {
    summaryUrl,
    fullUrl,
    moodleBaseUrl,
    checkedMoodleAdmin: checkMoodleAdmin,
  };
}
EOF
)"

  echo "Opening Playwright browser session: ${PLAYWRIGHT_CLI_SESSION}"
  "$PWCLI" open about:blank >/dev/null

  echo "Running tenant reporting smoke flow..."
  local output
  output="$("$PWCLI" run-code "$code" 2>&1)"
  printf '%s\n' "$output"
  if [[ "$output" == *"### Error"* ]]; then
    exit 1
  fi
}

main() {
  parse_args "$@"
  require_command curl
  require_command node
  require_command npx

  export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
  export PLAYWRIGHT_CLI_SESSION="tenant-report-smoke-${SUBDOMAIN}-$$"

  mkdir -p "$OUTPUT_DIR"
  trap close_session EXIT

  echo "Tenant report smoke test"
  echo "  app    : ${APP_BASE_URL}"
  echo "  moodle : ${MOODLE_BASE_URL}"
  echo "  tenant : ${SUBDOMAIN}"
  echo "  period : ${PERIOD_KEY}"

  check_moodle_guest_redirect
  run_app_and_optional_moodle_checks

  echo "Smoke test complete."
}

main "$@"
