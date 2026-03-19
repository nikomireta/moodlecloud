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

require_once(__DIR__ . '/../../config.php');

use local_moodlepilot_report\local\bootstrap_config;
use local_moodlepilot_report\local\report_snapshot_builder;
use local_moodlepilot_report\local\tracking_repository;

require_login();

$systemcontext = context_system::instance();
require_capability('moodle/site:config', $systemcontext);

admin_externalpage_setup('local_moodlepilot_report_dashboard');

$PAGE->set_context($systemcontext);
$PAGE->set_url(new moodle_url('/local/moodlepilot_report/index.php'));
$PAGE->set_title(get_string('dashboard:page_title', 'local_moodlepilot_report'));
$PAGE->set_heading(get_string('dashboard:page_heading', 'local_moodlepilot_report'));

$snapshot = report_snapshot_builder::build_last_7_days();
$payload = $snapshot['payload'] ?? [];

$formatdatetime = static function(string $value): string {
    $value = trim($value);
    if ($value === '') {
        return '-';
    }
    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return s($value);
    }
    return userdate($timestamp, get_string('strftimedatetime'));
};

$rendertable = static function(array $headers, array $rows): string {
    if (empty($rows)) {
        return html_writer::tag('p', get_string('dashboard:empty', 'local_moodlepilot_report'));
    }

    $table = new html_table();
    $table->head = $headers;
    $table->data = $rows;
    $table->attributes['class'] = 'generaltable';
    return html_writer::table($table);
};

$summaryrows = [
    [s('Period start'), $formatdatetime((string)($snapshot['period_start'] ?? ''))],
    [s('Period end'), $formatdatetime((string)($snapshot['period_end'] ?? ''))],
    [s('Logins'), (int)(($payload['summary_metrics']['login_count'] ?? 0))],
    [s('Active users'), (int)(($payload['summary_metrics']['active_users'] ?? 0))],
    [s('Submissions'), (int)(($payload['summary_metrics']['submissions'] ?? 0))],
    [s('Average session'), s((string)($payload['summary_metrics']['avg_online_label'] ?? '0 m'))],
];

$connectionrows = [
    [s('Bootstrap state'), s(bootstrap_config::bootstrap_state())],
    [s('Manual connect state'), s(bootstrap_config::manual_connect_state())],
    [s('Registration state'), s(bootstrap_config::registration_state())],
    [s('Connection mode'), s(bootstrap_config::display_value(bootstrap_config::connection_mode()))],
    [s('API base URL'), s(bootstrap_config::display_value(bootstrap_config::api_base_url()))],
    [s('Connect endpoint'), s(bootstrap_config::display_value(bootstrap_config::connect_endpoint()))],
    [s('Ingest URL'), s(bootstrap_config::display_value(bootstrap_config::ingest_url()))],
    [s('Manual site ID'), s(bootstrap_config::display_value(bootstrap_config::manual_site_id()))],
    [s('Tracking mode'), s(bootstrap_config::display_value(bootstrap_config::tracking_mode()))],
    [s('Last tracking seen'), s(bootstrap_config::display_value(bootstrap_config::last_tracking_seen_at()))],
    [s('Last rollup at'), s(bootstrap_config::display_value(bootstrap_config::last_rollup_at()))],
    [s('Registered at'), s(bootstrap_config::display_value(bootstrap_config::registered_at()))],
    [s('Last report push'), s(bootstrap_config::display_value(bootstrap_config::last_report_push_at()))],
    [s('Last bootstrap error'), s(bootstrap_config::display_value(bootstrap_config::last_bootstrap_error()))],
    [s('Last ingest error'), s(bootstrap_config::display_value(bootstrap_config::last_ingest_error()))],
];

$pipelinerows = [
    [s('Tracking interval'), bootstrap_config::tracking_interval_seconds() . ' s'],
    [s('Inactivity timeout'), bootstrap_config::tracking_inactivity_seconds() . ' s'],
    [s('Pending detail rows'), tracking_repository::pending_detail_count()],
];

$userstatusrows = [];
foreach (($payload['user_status'] ?? []) as $row) {
    $userstatusrows[] = [
        s((string)($row['user_name'] ?? '-')),
        s((string)($row['username'] ?? '-')),
        s((string)($row['email'] ?? '-')),
        s((string)($row['role_label'] ?? '-')),
        s((string)($row['course_name'] ?? '-')),
        s((string)($row['enrolment_method_label'] ?? $row['enrolment_method'] ?? '-')),
        $formatdatetime((string)($row['enrolled_on'] ?? '')),
        s((string)($row['status_label'] ?? '-')),
        format_float((float)($row['average_grade'] ?? 0), 1),
        $formatdatetime((string)($row['last_action_at'] ?? '')),
    ];
}

$activityrows = [];
foreach (($payload['activity_stats_summary'] ?? []) as $row) {
    $activityrows[] = [
        s((string)($row['course_name'] ?? '-')),
        s((string)($row['module_type'] ?? '-')),
        s((string)($row['component_name'] ?? '-')),
        s((string)($row['activity_label'] ?? '-')),
        (int)($row['visits'] ?? 0),
        s((string)($row['time_spent_label'] ?? '0 m')),
        $formatdatetime((string)($row['first_access_at'] ?? '')),
        $formatdatetime((string)($row['created_at'] ?? '')),
        (int)($row['num_completed'] ?? 0),
        (int)($row['total_events'] ?? 0),
        (int)($row['unique_users'] ?? 0),
        $formatdatetime((string)($row['last_activity_at'] ?? '')),
    ];
}

$quizrows = [];
foreach (($payload['quiz_activity_detail'] ?? []) as $row) {
    $quizrows[] = [
        s((string)($row['quiz_name'] ?? '-')),
        s((string)($row['course_name'] ?? '-')),
        s((string)($row['user_name'] ?? '-')),
        s((string)($row['email'] ?? '-')),
        (int)($row['attempts'] ?? 0),
        (int)($row['finished_attempts'] ?? 0),
        format_float((float)($row['best_score'] ?? 0), 1),
        format_float((float)($row['average_score'] ?? 0), 1),
        format_float((float)($row['lowest_score'] ?? 0), 1),
        s((string)($row['time_spent_label'] ?? '0 m')),
        s((string)($row['status_label'] ?? '-')),
        $formatdatetime((string)($row['completion_at'] ?? '')),
        $formatdatetime((string)($row['last_attempt_at'] ?? '')),
    ];
}

$recentactivityrows = [];
foreach (($payload['recent_activity'] ?? []) as $row) {
    $recentactivityrows[] = [
        s((string)($row['user_name'] ?? '-')),
        s((string)($row['action'] ?? '-')),
        $formatdatetime((string)($row['occurred_at'] ?? '')),
        s((string)($row['ip_address'] ?? '-')),
    ];
}

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('dashboard:page_heading', 'local_moodlepilot_report'));
echo html_writer::tag('p', get_string('dashboard:page_intro', 'local_moodlepilot_report'));

echo $OUTPUT->heading(get_string('dashboard:section_connection', 'local_moodlepilot_report'), 3);
echo $rendertable(['Field', 'Value'], $connectionrows);

echo $OUTPUT->heading(get_string('dashboard:section_pipeline', 'local_moodlepilot_report'), 3);
echo $rendertable(['Field', 'Value'], $pipelinerows);

echo $OUTPUT->heading(get_string('dashboard:section_summary', 'local_moodlepilot_report'), 3);
echo $rendertable(['Metric', 'Value'], $summaryrows);

echo $OUTPUT->heading(get_string('dashboard:section_user_status', 'local_moodlepilot_report'), 3);
echo $rendertable(['User', 'Username', 'Email', 'Role', 'Course', 'Enrolment', 'Enrolled On', 'Status', 'Avg Grade', 'Last Action'], $userstatusrows);

echo $OUTPUT->heading(get_string('dashboard:section_activity_stats', 'local_moodlepilot_report'), 3);
echo $rendertable(['Course', 'Module', 'Component', 'Activity', 'Visits', 'Time Spent', 'First Access', 'Created', 'Completed', 'Events', 'Users', 'Last Activity'], $activityrows);

echo $OUTPUT->heading(get_string('dashboard:section_quiz_detail', 'local_moodlepilot_report'), 3);
echo $rendertable(['Quiz', 'Course', 'User', 'Email', 'Attempts', 'Finished', 'Best', 'Average', 'Lowest', 'Time Spent', 'Status', 'Completed At', 'Last Attempt'], $quizrows);

echo $OUTPUT->heading(get_string('dashboard:section_recent_activity', 'local_moodlepilot_report'), 3);
echo $rendertable(['User', 'Action', 'When', 'IP'], $recentactivityrows);

echo $OUTPUT->footer();
