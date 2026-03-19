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

namespace local_moodlepilot_report;

use core\hook\output\before_standard_top_of_body_html_generation;
use local_moodlepilot_report\local\bootstrap_config;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for Moodlepilot report plugin.
 *
 * @package    local_moodlepilot_report
 * @copyright  2026
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {
    /**
     * Queue browser tracking AMD bootstrap on normal logged-in pages.
     *
     * @param before_standard_top_of_body_html_generation $hook
     */
    public static function before_standard_top_of_body_html_generation(
        before_standard_top_of_body_html_generation $hook,
    ): void {
        global $COURSE, $PAGE, $USER;

        if (!bootstrap_config::plugin_enabled()) {
            return;
        }
        if ((defined('CLI_SCRIPT') && CLI_SCRIPT) || (defined('AJAX_SCRIPT') && AJAX_SCRIPT) || (defined('WS_SERVER') && WS_SERVER)) {
            return;
        }
        if (!isloggedin() || isguestuser() || empty($USER->id) || empty($PAGE)) {
            return;
        }

        $requesturi = trim((string)($_SERVER['REQUEST_URI'] ?? ''));
        if ($requesturi !== '' && strpos($requesturi, '/login/') !== false) {
            return;
        }

        $courseid = 0;
        if (!empty($COURSE->id) && (int)$COURSE->id !== SITEID) {
            $courseid = (int)$COURSE->id;
        }

        $pagetype = 'site';
        $pageinstance = 0;
        if (!empty($PAGE->context)) {
            $contextlevel = (int)($PAGE->context->contextlevel ?? 0);
            if ($contextlevel === CONTEXT_MODULE) {
                $pagetype = 'module';
                $pageinstance = (int)($PAGE->context->instanceid ?? 0);
            } else if ($contextlevel === CONTEXT_COURSE || $courseid > 0) {
                $pagetype = 'course';
                $pageinstance = $courseid > 0 ? $courseid : (int)($PAGE->context->instanceid ?? 0);
                $courseid = $pageinstance;
            }
        }

        $pagelabel = trim(strip_tags((string)($PAGE->heading ?? $PAGE->title ?? $PAGE->pagetype ?? '')));
        if ($pagelabel === '') {
            $pagelabel = $pagetype;
        }

        $PAGE->requires->js_call_amd('local_moodlepilot_report/tracking', 'init', [[
            'pageType' => $pagetype,
            'pageInstance' => max(0, $pageinstance),
            'courseId' => max(0, $courseid),
            'pageLabel' => substr($pagelabel, 0, 255),
            'intervalSeconds' => bootstrap_config::tracking_interval_seconds(),
            'inactivitySeconds' => bootstrap_config::tracking_inactivity_seconds(),
        ]]);
    }
}
