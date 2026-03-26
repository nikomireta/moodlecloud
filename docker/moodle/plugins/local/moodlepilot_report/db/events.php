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

$observers = [
    [
        'eventname' => '\core\event\user_created',
        'callback' => '\local_moodlepilot_report\observer::user_created',
    ],
    [
        'eventname' => '\core\event\user_loggedin',
        'callback' => '\local_moodlepilot_report\observer::user_loggedin',
    ],
    [
        'eventname' => '\core\event\course_viewed',
        'callback' => '\local_moodlepilot_report\observer::course_viewed',
    ],
    [
        'eventname' => '\core\event\course_module_viewed',
        'callback' => '\local_moodlepilot_report\observer::course_module_viewed',
    ],
    [
        'eventname' => '\core\event\user_enrolment_created',
        'callback' => '\local_moodlepilot_report\observer::user_enrolment_created',
    ],
    [
        'eventname' => '\core\event\course_completed',
        'callback' => '\local_moodlepilot_report\observer::course_completed',
    ],
    [
        'eventname' => '\core\event\course_module_completion_updated',
        'callback' => '\local_moodlepilot_report\observer::course_module_completion_updated',
    ],
    [
        'eventname' => '\core\event\user_graded',
        'callback' => '\local_moodlepilot_report\observer::user_graded',
    ],
    [
        'eventname' => '\mod_assign\event\assessable_submitted',
        'callback' => '\local_moodlepilot_report\observer::assign_attempt_submitted',
    ],
    [
        'eventname' => '\mod_quiz\event\attempt_submitted',
        'callback' => '\local_moodlepilot_report\observer::quiz_attempt_submitted',
    ],
    [
        'eventname' => '\mod_forum\event\post_created',
        'callback' => '\local_moodlepilot_report\observer::forum_post_created',
    ],
];
