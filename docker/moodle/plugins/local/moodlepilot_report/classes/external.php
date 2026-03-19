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

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->libdir . '/externallib.php');

use local_moodlepilot_report\local\tracking_repository;

class external extends \external_api {
    public static function track_heartbeat_parameters(): \external_function_parameters {
        return new \external_function_parameters([
            'page_type' => new \external_value(PARAM_ALPHANUMEXT, 'Logical page type such as site, course, or module'),
            'page_instance' => new \external_value(PARAM_INT, 'Page instance ID', VALUE_OPTIONAL, 0),
            'course_id' => new \external_value(PARAM_INT, 'Course ID if known', VALUE_OPTIONAL, 0),
            'page_label' => new \external_value(PARAM_TEXT, 'Human readable page label', VALUE_OPTIONAL, ''),
            'visit_delta' => new \external_value(PARAM_INT, 'Visit increment for first page hit', VALUE_OPTIONAL, 0),
            'active_seconds' => new \external_value(PARAM_INT, 'Active seconds observed in this heartbeat window', VALUE_OPTIONAL, 0),
            'media_active' => new \external_value(PARAM_BOOL, 'Whether playable media is active', VALUE_OPTIONAL, false),
            'observed_at' => new \external_value(PARAM_INT, 'Unix timestamp captured by the browser', VALUE_OPTIONAL, 0),
        ]);
    }

    public static function track_heartbeat(
        string $page_type,
        int $page_instance = 0,
        int $course_id = 0,
        string $page_label = '',
        int $visit_delta = 0,
        int $active_seconds = 0,
        bool $media_active = false,
        int $observed_at = 0
    ): array {
        global $USER;

        $params = self::validate_parameters(self::track_heartbeat_parameters(), [
            'page_type' => $page_type,
            'page_instance' => $page_instance,
            'course_id' => $course_id,
            'page_label' => $page_label,
            'visit_delta' => $visit_delta,
            'active_seconds' => $active_seconds,
            'media_active' => $media_active,
            'observed_at' => $observed_at,
        ]);

        self::validate_context(\context_system::instance());

        if (!isloggedin() || isguestuser() || empty($USER->id)) {
            throw new \moodle_exception('tracking:error_not_logged_in', 'local_moodlepilot_report');
        }

        $lastseen = tracking_repository::track_browser_heartbeat($params);

        return [
            'acknowledged' => true,
            'message' => get_string('tracking:acknowledged', 'local_moodlepilot_report'),
            'tracking_last_seen_at' => $lastseen,
        ];
    }

    public static function track_heartbeat_returns(): \external_single_structure {
        return new \external_single_structure([
            'acknowledged' => new \external_value(PARAM_BOOL, 'Whether the heartbeat was accepted'),
            'message' => new \external_value(PARAM_TEXT, 'Acknowledgement message'),
            'tracking_last_seen_at' => new \external_value(PARAM_TEXT, 'RFC3339 timestamp for the last accepted tracking heartbeat'),
        ]);
    }
}
