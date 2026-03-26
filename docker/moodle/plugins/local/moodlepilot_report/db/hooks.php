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

$callbacks = [
    [
        'hook' => \core\hook\output\before_standard_top_of_body_html_generation::class,
        'callback' => \local_moodlepilot_report\hook_callbacks::class . '::before_standard_top_of_body_html_generation',
    ],
    [
        'hook' => \core_files\hook\before_file_created::class,
        'callback' => \local_moodlepilot_report\hook_listener::class . '::before_file_created',
        'priority' => 1000,
    ],
    [
        'hook' => \core_user\hook\before_user_updated::class,
        'callback' => \local_moodlepilot_report\hook_listener::class . '::before_user_updated',
        'priority' => 1000,
    ],
];
