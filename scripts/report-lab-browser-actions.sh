#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MANIFEST_PATH=""
PASSWORD="${GENERATOR_USER_PASSWORD:-JMeterGen123!}"
KEEP_BROWSER="false"

usage() {
  cat <<'EOF'
Usage:
  report-lab-browser-actions.sh --manifest <path> [options]

Options:
  --password <password>  Password shared by generated tool_generator users
  --keep-browser         Leave the Playwright browser session open

This script logs in as the generated learners from the manifest and performs
real browser visits across course, page, forum, assignment, and quiz surfaces
so Moodlepilot heartbeat/session tracking sees actual JS activity.
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
  if [[ "$KEEP_BROWSER" == "true" ]]; then
    return
  fi
  if [[ -n "${PLAYWRIGHT_CLI_SESSION:-}" ]]; then
    "$PWCLI" close >/dev/null 2>&1 || true
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --manifest)
        MANIFEST_PATH="$2"
        shift 2
        ;;
      --password)
        PASSWORD="$2"
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
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "$MANIFEST_PATH" ]]; then
    usage >&2
    exit 1
  fi
  if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo "Manifest file not found: $MANIFEST_PATH" >&2
    exit 1
  fi
}

main() {
  parse_args "$@"
  require_command node
  require_command npx

  export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
  export PLAYWRIGHT_CLI_SESSION="report-lab-browser-actions-$$"

  if [[ ! -x "$PWCLI" ]]; then
    echo "Playwright CLI wrapper is missing: $PWCLI" >&2
    exit 1
  fi

  local manifest_json
  manifest_json="$(node -e 'const fs = require("fs"); const path = process.argv[1]; const data = JSON.parse(fs.readFileSync(path, "utf8")); process.stdout.write(JSON.stringify(data));' "$MANIFEST_PATH")"

  local manifest_js password_js
  manifest_js="$(json_quote "$manifest_json")"
  password_js="$(json_quote "$PASSWORD")"

  local code
  code="$(cat <<EOF
async (page) => {
  const manifest = JSON.parse(${manifest_js});
  const password = ${password_js};
  const browser = page.context().browser();
  const users = manifest.actors.browser_users;
  const assignmentSubmitters = new Set((manifest.actors.assignment_submitters || []).map((user) => user.username));
  const quizResponsePatterns = new Map(
    (manifest.quiz_response_patterns || []).map((item) => [item.username, item.responses || []])
  );
  const urls = {
    course: manifest.course.url,
    page: manifest.special_modules.page.url,
    forum: manifest.special_modules.forum.url,
    assignment: manifest.special_modules.assignment.url,
    quiz: manifest.special_modules.quiz.url,
  };

  const delay = async (ms) => page.waitForTimeout(ms);
  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };
  const goTo = async (p, url, dwell = 2500) => {
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.mouse.move(240, 220);
    await delay(dwell);
  };
  const maybeMarkDone = async (p) => {
    const button = p.getByRole("button", { name: /Mark as done/i });
    if (await button.count()) {
      await button.first().click().catch(() => undefined);
      await delay(400);
    }
  };
  const maybeSubmitAssignment = async (p, user) => {
    if (!assignmentSubmitters.has(user.username)) {
      return false;
    }

    const addSubmission = p.getByRole("button", { name: /Add submission/i });
    if (!await addSubmission.count()) {
      return false;
    }

    await Promise.all([
      p.waitForLoadState("domcontentloaded"),
      addSubmission.first().click(),
    ]);

    const editor = p.locator('textarea[name="onlinetext_editor[text]"]');
    if (await editor.count()) {
      await editor.fill("Browser-submitted lab assignment by " + user.username + ".");
    }

    const save = p.locator('input[name="submitbutton"]');
    if (await save.count()) {
      await Promise.all([
        p.waitForLoadState("domcontentloaded"),
        save.first().click(),
      ]);
      await delay(600);
      return true;
    }

    return false;
  };
  const maybeCompleteQuiz = async (p, user) => {
    const responses = quizResponsePatterns.get(user.username) || [];
    if (!responses.length) {
      return false;
    }

    const launch = p.getByRole("button", {
      name: /Attempt quiz|Attempt quiz now|Continue your attempt/i,
    });
    if (await launch.count()) {
      await Promise.all([
        p.waitForLoadState("domcontentloaded"),
        launch.first().click(),
      ]);
      await delay(500);
    }

    for (const response of responses) {
      const option = p.getByLabel(response, { exact: true });
      if (!await option.count()) {
        continue;
      }

      await option.check();
      const next = p.locator('input[name="next"]');
      if (await next.count()) {
        await Promise.all([
          p.waitForLoadState("domcontentloaded"),
          next.first().click(),
        ]);
        await delay(250);
      }
    }

    const submitButtons = p.getByRole("button", { name: /Submit all and finish/i });
    if (!await submitButtons.count()) {
      return false;
    }

    await submitButtons.first().click();
    await delay(500);

    const submitConfirmButtons = p.getByRole("button", { name: /Submit all and finish/i });
    if (await submitConfirmButtons.count()) {
      await Promise.all([
        p.waitForURL(/\\/mod\\/quiz\\/(review|view)\\.php/, { timeout: 15000 }).catch(() => undefined),
        submitConfirmButtons.last().click(),
      ]);
      await delay(500);
    }

    return true;
  };

  const outcomes = {
    visitedUsers: [],
    assignmentSubmissions: [],
    quizAttempts: [],
  };

  for (const user of users) {
    const context = await browser.newContext();
    const p = await context.newPage();

    await p.goto(manifest.site_url + "/login/index.php", { waitUntil: "domcontentloaded" });
    await p.locator('form#login input[name="username"]').fill(user.username);
    await p.locator('form#login input[name="password"]').fill(password);
    await Promise.all([
      p.waitForURL(/\\/my\\/?(?:\\?|$)/, { timeout: 30000 }),
      p.locator('form#login button[type="submit"]').click(),
    ]);

    await p.goto(urls.course, { waitUntil: "domcontentloaded" });
    await p.mouse.move(200, 180);
    await p.mouse.wheel(0, 320);
    await delay(16000);
    outcomes.visitedUsers.push(user.username);

    await goTo(p, urls.page);
    await maybeMarkDone(p);

    await goTo(p, urls.forum);
    await maybeMarkDone(p);

    await goTo(p, urls.assignment);
    await maybeMarkDone(p);
    if (await maybeSubmitAssignment(p, user)) {
      outcomes.assignmentSubmissions.push(user.username);
    }

    await goTo(p, urls.quiz);
    await maybeMarkDone(p);
    if (await maybeCompleteQuiz(p, user)) {
      outcomes.quizAttempts.push(user.username);
    }

    await context.close();
  }

  assert(users.length === 10, "Expected exactly 10 browser users in manifest.");
  return {
    ...outcomes,
    courseUrl: urls.course,
    moduleUrls: [urls.page, urls.forum, urls.assignment, urls.quiz],
  };
}
EOF
)"

  trap close_session EXIT
  "$PWCLI" open about:blank >/dev/null
  local output
  output="$("$PWCLI" run-code "$code" 2>&1)"
  printf '%s\n' "$output"
  if [[ "$output" == *"### Error"* ]]; then
    exit 1
  fi
}

main "$@"
