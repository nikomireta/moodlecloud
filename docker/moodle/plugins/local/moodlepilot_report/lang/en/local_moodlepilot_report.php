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

$string['pluginname'] = 'Moodlepilot report';
$string['privacy:metadata'] = 'The Moodlepilot report plugin stores analytics tracking, report aggregates, and sync journal data for Moodlepilot-owned reporting.';
$string['privacy:metadata:local_mpilot_rpt_detail'] = 'Stores granular browser heartbeat slices before they are rolled up into report aggregates.';
$string['privacy:metadata:local_mpilot_rpt_track'] = 'Stores aggregated page and activity tracking per user.';
$string['privacy:metadata:local_mpilot_rpt_log'] = 'Stores hourly rollups for tracked activity records.';
$string['privacy:metadata:local_mpilot_rpt_event'] = 'Stores raw event observations captured by the Moodlepilot report plugin.';
$string['privacy:metadata:local_mpilot_rpt_total'] = 'Stores daily aggregate counters used for summary reporting.';
$string['privacy:metadata:local_mpilot_rpt_sync'] = 'Stores report sync journal entries for pushes to Moodlepilot.';
$string['privacy:metadata:userid'] = 'The ID of the user associated with the tracked activity.';
$string['privacy:metadata:relateduserid'] = 'The related user ID associated with an observed Moodle event.';
$string['privacy:metadata:courseid'] = 'The ID of the course associated with the tracked activity.';
$string['privacy:metadata:page_type'] = 'The logical page type tracked by the plugin, such as site, course, or module.';
$string['privacy:metadata:page_instance'] = 'The instance ID of the tracked page or activity.';
$string['privacy:metadata:page_label'] = 'A human-readable label for the tracked page or activity.';
$string['privacy:metadata:visits'] = 'The number of visits counted for the tracked record.';
$string['privacy:metadata:visit_count'] = 'The number of new page visits counted in the granular heartbeat bucket.';
$string['privacy:metadata:heartbeat_count'] = 'The number of browser heartbeat pings aggregated in the detail bucket.';
$string['privacy:metadata:active_seconds'] = 'The number of actively engaged seconds captured in the detail bucket.';
$string['privacy:metadata:session_starts'] = 'The number of new sessions detected for the tracked record.';
$string['privacy:metadata:time_spent'] = 'The estimated time spent, in seconds, on the tracked record.';
$string['privacy:metadata:first_access'] = 'The timestamp of the first access recorded for the tracked record.';
$string['privacy:metadata:last_access'] = 'The timestamp of the most recent access recorded for the tracked record.';
$string['privacy:metadata:useragent'] = 'The browser user agent captured during tracking.';
$string['privacy:metadata:userlang'] = 'The browser language header captured during tracking.';
$string['privacy:metadata:userip'] = 'The IP address captured during tracking.';
$string['privacy:metadata:rolled_up_at'] = 'The timestamp when the granular detail row was processed into report aggregates.';
$string['privacy:metadata:timecreated'] = 'The timestamp when the record was created.';
$string['privacy:metadata:timemodified'] = 'The timestamp when the record was last updated.';
$string['privacy:metadata:trackid'] = 'The parent tracking record ID for the hourly rollup.';
$string['privacy:metadata:bucket_start'] = 'The start timestamp of the aggregation bucket.';
$string['privacy:metadata:component'] = 'The Moodle component that emitted the observed event.';
$string['privacy:metadata:action'] = 'The Moodle event action name.';
$string['privacy:metadata:target'] = 'The Moodle event target name.';
$string['privacy:metadata:eventname'] = 'The fully qualified Moodle event class name.';
$string['privacy:metadata:objecttable'] = 'The Moodle database table referenced by the event.';
$string['privacy:metadata:objectid'] = 'The Moodle object ID referenced by the event.';
$string['privacy:metadata:contextlevel'] = 'The Moodle context level for the observed event.';
$string['privacy:metadata:metadata'] = 'Additional JSON metadata stored for the observed event.';
$string['privacy:metadata:login_count'] = 'The number of login events aggregated for the period bucket.';
$string['privacy:metadata:session_count'] = 'The number of sessions aggregated for the period bucket.';
$string['privacy:metadata:submission_count'] = 'The number of submission events aggregated for the period bucket.';
$string['privacy:metadata:quiz_attempt_count'] = 'The number of quiz attempts aggregated for the period bucket.';
$string['privacy:metadata:grade_event_count'] = 'The number of grading events aggregated for the period bucket.';
$string['privacy:metadata:course_view_count'] = 'The number of course view events aggregated for the period bucket.';
$string['privacy:metadata:module_view_count'] = 'The number of module view events aggregated for the period bucket.';
$string['privacy:metadata:completion_count'] = 'The number of completion events aggregated for the period bucket.';
$string['privacy:metadata:enrolment_count'] = 'The number of enrolment events aggregated for the period bucket.';
$string['privacy:metadata:forum_post_count'] = 'The number of forum post events aggregated for the period bucket.';
$string['privacy:metadata:sync_type'] = 'The type of report sync operation recorded in the sync journal.';
$string['privacy:metadata:snapshot_key'] = 'The snapshot key associated with the sync journal entry.';
$string['privacy:metadata:period_key'] = 'The reporting period key associated with the sync journal entry.';
$string['privacy:metadata:status'] = 'The current status of the sync journal entry.';
$string['privacy:metadata:item_count'] = 'The number of report items included in the synced payload.';
$string['privacy:metadata:payload_hash'] = 'A checksum of the synced payload.';
$string['privacy:metadata:last_error'] = 'The last sync error message, when a sync fails.';
$string['privacy:metadata:started_at'] = 'The timestamp when the sync operation started.';
$string['privacy:metadata:completed_at'] = 'The timestamp when the sync operation completed.';

$string['dashboard:page_title'] = 'Moodlepilot report connector';
$string['dashboard:page_heading'] = 'Moodlepilot report connector status';
$string['dashboard:page_intro'] = 'This admin page is for plugin connection, tracking freshness, snapshot sync status, and troubleshooting. Tenant-facing reporting now lives in the Moodlepilot dashboard application.';
$string['dashboard:nav_label'] = 'Report connector';
$string['dashboard:section_summary'] = 'Summary metrics';
$string['dashboard:section_daily_trend'] = 'Daily trend';
$string['dashboard:section_course_completion'] = 'Course completion summary';
$string['dashboard:section_grade_recap'] = 'Grade recap per course';
$string['dashboard:section_user_activity'] = 'User activity summary';
$string['dashboard:section_connection'] = 'Connection health';
$string['dashboard:section_pipeline'] = 'Tracking pipeline';
$string['dashboard:section_quota'] = 'Package quota';
$string['dashboard:section_capabilities'] = 'Plugin capabilities';
$string['dashboard:section_notes'] = 'Connector notes';
$string['dashboard:section_user_status'] = 'User status';
$string['dashboard:section_at_risk'] = 'At-risk users';
$string['dashboard:section_activity_stats'] = 'Activity stats summary';
$string['dashboard:section_quiz_detail'] = 'Quiz activity detail';
$string['dashboard:section_recent_activity'] = 'Recent activity';
$string['dashboard:report_surface_note'] = 'Tenant reports are now consumed from the Moodlepilot dashboard application. Moodle keeps only the technical connector page for admins.';
$string['dashboard:quota_over_limit_notice'] = 'Package quota is currently over limit. New uploads or user activations may be blocked until usage is reduced.';
$string['dashboard:quota_warning_notice'] = 'Package quota is nearing its limit. Review active users and storage before tenant activity increases.';
$string['dashboard:empty'] = 'No data available for the current filters.';
$string['dashboard:filter_period'] = 'Period';
$string['dashboard:filter_course'] = 'Course';
$string['dashboard:filter_apply'] = 'Apply filters';
$string['dashboard:filter_reset'] = 'Reset';
$string['dashboard:filter_all_courses'] = 'All courses';
$string['dashboard:period:today'] = 'Today';
$string['dashboard:period:last_7_days'] = 'Last 7 days';
$string['dashboard:period:last_30_days'] = 'Last 30 days';
$string['dashboard:period:this_month'] = 'This month';
$string['dashboard:period:last_month'] = 'Last month';
$string['dashboard:export_csv'] = 'Export CSV';

$string['settings:enabled'] = 'Enable plugin scaffold';
$string['settings:enabled_desc'] = 'Keeps the Moodlepilot reporting scaffold enabled for this tenant.';

$string['bootstrap:heading'] = 'Bootstrap status';
$string['bootstrap:description'] = 'This section shows provisioning-driven bootstrap values. Moodlepilot-managed sites are expected to auto-authorize through these values when available.';
$string['bootstrap:state_label'] = 'Bootstrap state';
$string['bootstrap:site_id_label'] = 'Provisioned site ID';
$string['bootstrap:auto_authorize_label'] = 'Auto-authorize mode';
$string['bootstrap:api_base_url_label'] = 'Backend API base URL';
$string['bootstrap:token_label'] = 'Bootstrap token';
$string['bootstrap:not_configured'] = 'Not configured';

$string['bootstrap:state:missing_site_id'] = 'Missing site bootstrap';
$string['bootstrap:state:disabled'] = 'Auto-authorize disabled';
$string['bootstrap:state:partial'] = 'Partial bootstrap';
$string['bootstrap:state:ready'] = 'Ready for registration handshake';

$string['manual:heading'] = 'Manual connect';
$string['manual:description'] = 'Use this section when the plugin is installed or upgraded outside the normal Moodlepilot provisioning flow. Once these values are filled, the scheduled registration task will attempt a manual connect handshake.';
$string['manual:settings_intro'] = 'Provide the site ID, Moodlepilot API base URL, and connect token issued by Moodlepilot. The plugin will try to register itself on the next cron run.';
$string['manual:state_label'] = 'Manual connect state';
$string['manual:site_id_label'] = 'Manual site ID';
$string['manual:site_id_desc'] = 'The Moodlepilot site ID that should be linked to this Moodle instance.';
$string['manual:api_base_url_label'] = 'Manual API base URL';
$string['manual:api_base_url_desc'] = 'The Moodlepilot backend API base URL used for manual connect registration.';
$string['manual:token_label'] = 'Connect token';
$string['manual:token_desc'] = 'The connect token generated by Moodlepilot for this site.';
$string['manual:reconnect_label'] = 'Reconnect on next cron';
$string['manual:reconnect_desc'] = 'When enabled, the next registration cron run will request a fresh ingest token using the manual connect settings and then clear this flag.';
$string['manual:state:not_configured'] = 'Manual connect not configured';
$string['manual:state:partial'] = 'Manual connect incomplete';
$string['manual:state:ready'] = 'Ready for manual connect';

$string['connection:description'] = 'The plugin registers with Moodlepilot through a scheduled task. It can use automatic bootstrap for provisioned tenants or manual connect settings for standalone and upgraded installations.';
$string['connection:state_label'] = 'Connection state';
$string['connection:mode_label'] = 'Connection mode';
$string['connection:bootstrap_endpoint_label'] = 'Bootstrap endpoint';
$string['connection:connect_endpoint_label'] = 'Manual connect endpoint';
$string['connection:ingest_url_label'] = 'Ingest URL';
$string['connection:ingest_token_label'] = 'Ingest token';
$string['connection:registered_at_label'] = 'Registered at';
$string['connection:last_error_label'] = 'Last bootstrap error';
$string['connection:last_push_at_label'] = 'Last report push';
$string['connection:last_ingest_error_label'] = 'Last ingest error';
$string['connection:state:pending'] = 'Pending registration';
$string['connection:state:bootstrap_incomplete'] = 'Waiting for full bootstrap config';
$string['connection:state:manual_incomplete'] = 'Waiting for complete manual connect settings';
$string['connection:state:registered'] = 'Registered with Moodlepilot';
$string['connection:state:error'] = 'Registration error';
$string['connection:state:disabled'] = 'Disabled';
$string['connection:state:not_connected'] = 'Not connected';
$string['connection:error_unknown'] = 'Unknown bootstrap error';
$string['connection:error_invalid_payload'] = 'Unable to encode bootstrap payload.';
$string['connection:error_missing_ingest_token'] = 'Bootstrap response did not include an ingest token.';
$string['connection:error_missing_endpoint'] = 'Registration endpoint is not configured.';
$string['quota:description'] = 'Live package quota status fetched from Moodlepilot. This status is used by the quota guard that blocks uploads and active-user growth when the package limit is exceeded.';
$string['quota:plan_label'] = 'Package';
$string['quota:status_label'] = 'Quota status';
$string['quota:users_label'] = 'Active users';
$string['quota:storage_label'] = 'Total storage';
$string['quota:files_label'] = 'Files usage';
$string['quota:database_label'] = 'Database usage';
$string['quota:last_measured_label'] = 'Last measured';
$string['quota:source_label'] = 'Usage source';
$string['quota:status:normal'] = 'Normal';
$string['quota:status:warning'] = 'Warning';
$string['quota:status:critical'] = 'Critical';
$string['quota:status:over_limit'] = 'Over limit';
$string['quota:status:unknown'] = 'Unavailable';
$string['quota:source:live'] = 'Live measurement';
$string['quota:source:stored'] = 'Stored snapshot';
$string['quota:source:empty'] = 'Initial baseline';

$string['task:bootstrap_registration'] = 'Register Moodlepilot report plugin';
$string['task:tracking_rollup'] = 'Roll up Moodlepilot browser tracking';
$string['task:report_snapshot_ingest'] = 'Push Moodlepilot report snapshot';

$string['report:error_not_registered'] = 'Plugin is waiting for automatic registration before pushing reports.';
$string['report:error_missing_ingest_target'] = 'Ingest target is not fully configured yet.';
$string['report:error_invalid_payload'] = 'Unable to encode report snapshot payload.';
$string['report:error_unknown'] = 'Unknown report ingest error.';
$string['quota:error_users_limit_reached'] = 'Active user quota reached. This site allows up to {$a->limit} active users and currently has {$a->used}. Suspend or delete another user first, or upgrade the package.';
$string['quota:error_storage_limit_reached'] = 'Storage quota reached. This upload would use {$a->projected} of {$a->limit}. Current usage is {$a->used} and the incoming file is {$a->upload}. Remove files first, or upgrade the package.';
$string['tracking:error_not_logged_in'] = 'Only logged-in non-guest users may send tracking heartbeats.';
$string['tracking:acknowledged'] = 'Tracking heartbeat accepted.';
