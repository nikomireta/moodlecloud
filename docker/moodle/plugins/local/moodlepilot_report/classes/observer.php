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

use local_moodlepilot_report\local\analytics_repository;

class observer {
    public static function user_loggedin(\core\event\user_loggedin $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'site',
            'page_instance' => 0,
            'page_label' => 'site',
        ]);
    }

    public static function course_viewed(\core\event\course_viewed $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'course',
            'page_instance' => (int)$event->courseid,
        ]);
    }

    public static function course_module_viewed(\core\event\course_module_viewed $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'module',
            'page_instance' => max((int)$event->contextinstanceid, (int)$event->objectid),
        ]);
    }

    public static function user_enrolment_created(\core\event\user_enrolment_created $event): void {
        analytics_repository::track_event($event, [
            'userid' => (int)$event->relateduserid,
            'page_type' => 'course',
            'page_instance' => (int)$event->courseid,
        ]);
    }

    public static function course_completed(\core\event\course_completed $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'course',
            'page_instance' => (int)$event->courseid,
        ]);
    }

    public static function course_module_completion_updated(\core\event\course_module_completion_updated $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'module',
            'page_instance' => max((int)$event->contextinstanceid, (int)$event->objectid),
        ]);
    }

    public static function user_graded(\core\event\user_graded $event): void {
        analytics_repository::track_event($event, [
            'userid' => (int)($event->relateduserid ?: $event->userid),
            'page_type' => 'course',
            'page_instance' => (int)$event->courseid,
        ]);
    }

    public static function assign_attempt_submitted(\mod_assign\event\assessable_submitted $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'module',
            'page_instance' => max((int)$event->contextinstanceid, (int)$event->objectid),
        ]);
    }

    public static function quiz_attempt_submitted(\mod_quiz\event\attempt_submitted $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'module',
            'page_instance' => max((int)$event->contextinstanceid, (int)$event->objectid),
        ]);
    }

    public static function forum_post_created(\mod_forum\event\post_created $event): void {
        analytics_repository::track_event($event, [
            'page_type' => 'module',
            'page_instance' => max((int)$event->contextinstanceid, (int)$event->objectid),
        ]);
    }
}
