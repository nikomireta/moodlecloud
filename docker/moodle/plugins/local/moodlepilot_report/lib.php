<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

defined('MOODLE_INTERNAL') || die();

use local_moodlepilot_report\local\bootstrap_config;

function local_moodlepilot_report_tracking_enabled(): bool {
    return bootstrap_config::plugin_enabled() && isloggedin() && !isguestuser();
}

function local_moodlepilot_report_after_require_login(
    $courseorid = null,
    $autologinguest = null,
    $cm = null,
    $setwantsurltome = null,
    $preventredirect = null,
): void {
    global $COURSE, $PAGE, $USER;

    if (!local_moodlepilot_report_tracking_enabled()) {
        return;
    }
    if ((defined('CLI_SCRIPT') && CLI_SCRIPT) || (defined('AJAX_SCRIPT') && AJAX_SCRIPT) || (defined('WS_SERVER') && WS_SERVER)) {
        return;
    }
    if (empty($USER->id) || empty($PAGE)) {
        return;
    }

    $requesturi = trim((string)($_SERVER['REQUEST_URI'] ?? ''));
    if ($requesturi !== '' && strpos($requesturi, '/login/') !== false) {
        return;
    }

    try {
        $pagecontext = $PAGE->context;
        $requires = $PAGE->requires;
    } catch (Throwable $exception) {
        return;
    }

    $courseid = 0;
    if (!empty($COURSE->id) && (int)$COURSE->id !== SITEID) {
        $courseid = (int)$COURSE->id;
    }

    $pagetype = 'site';
    $pageinstance = 0;
    $contextlevel = (int)($pagecontext->contextlevel ?? 0);
    $contextinstanceid = (int)($pagecontext->instanceid ?? 0);
    $pagepagetype = (string)($PAGE->pagetype ?? '');
    $issitelevelpage = str_starts_with($pagepagetype, 'my-') || str_starts_with($pagepagetype, 'site-');
    if ($issitelevelpage) {
        $courseid = 0;
    } else if ($contextlevel === CONTEXT_MODULE && !empty($cm->id)) {
        $pagetype = 'module';
        $pageinstance = (int)$cm->id;
    } else if ($courseid > 0) {
        $pagetype = 'course';
        $pageinstance = $courseid;
    } else if ($contextlevel === CONTEXT_COURSE && $contextinstanceid > 0 && $contextinstanceid !== SITEID) {
        $pagetype = 'course';
        $pageinstance = $contextinstanceid;
        $courseid = $contextinstanceid;
    }

    $pagelabel = '';
    foreach ([$PAGE->heading ?? '', $PAGE->title ?? '', $PAGE->pagetype ?? ''] as $candidate) {
        $candidate = trim(strip_tags((string)$candidate));
        if ($candidate !== '') {
            $pagelabel = $candidate;
            break;
        }
    }
    if ($pagelabel === '') {
        $pagelabel = $pagetype;
    }

    $requires->js_call_amd('local_moodlepilot_report/tracking', 'init', [[
        'pageType' => $pagetype,
        'pageInstance' => max(0, $pageinstance),
        'courseId' => max(0, $courseid),
        'pageLabel' => substr($pagelabel, 0, 255),
        'intervalSeconds' => bootstrap_config::tracking_interval_seconds(),
        'inactivitySeconds' => bootstrap_config::tracking_inactivity_seconds(),
    ]]);
}

function local_moodlepilot_report_before_standard_top_of_body_html(): string {
    return '';
}
