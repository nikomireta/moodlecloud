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

function xmldb_local_moodlepilot_report_upgrade(int $oldversion): bool {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026031900) {
        $table = new xmldb_table('local_mpilot_rpt_track');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('page_type', XMLDB_TYPE_CHAR, '32', null, XMLDB_NOTNULL, null, null);
            $table->add_field('page_instance', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('page_label', XMLDB_TYPE_CHAR, '255', null, null, null, null);
            $table->add_field('visits', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('session_starts', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('time_spent', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('first_access', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('last_access', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('useragent', XMLDB_TYPE_CHAR, '255', null, null, null, null);
            $table->add_field('userlang', XMLDB_TYPE_CHAR, '32', null, null, null, null);
            $table->add_field('userip', XMLDB_TYPE_CHAR, '64', null, null, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('userid_page_instance_idx', XMLDB_INDEX_UNIQUE, ['userid', 'page_type', 'page_instance']);
            $table->add_index('courseid_lastaccess_idx', XMLDB_INDEX_NOTUNIQUE, ['courseid', 'last_access']);
            $dbman->create_table($table);
        }

        $table = new xmldb_table('local_mpilot_rpt_log');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('trackid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('bucket_start', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('visits', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('session_starts', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('time_spent', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('last_access', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('track_bucket_idx', XMLDB_INDEX_UNIQUE, ['trackid', 'bucket_start']);
            $dbman->create_table($table);
        }

        $table = new xmldb_table('local_mpilot_rpt_event');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('relateduserid', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('page_type', XMLDB_TYPE_CHAR, '32', null, XMLDB_NOTNULL, null, null);
            $table->add_field('page_instance', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('component', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('action', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('target', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('eventname', XMLDB_TYPE_CHAR, '255', null, XMLDB_NOTNULL, null, null);
            $table->add_field('objecttable', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('objectid', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('contextlevel', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('metadata', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table->add_field('useragent', XMLDB_TYPE_CHAR, '255', null, null, null, null);
            $table->add_field('userip', XMLDB_TYPE_CHAR, '64', null, null, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('userid_timecreated_idx', XMLDB_INDEX_NOTUNIQUE, ['userid', 'timecreated']);
            $table->add_index('course_component_idx', XMLDB_INDEX_NOTUNIQUE, ['courseid', 'component', 'target']);
            $table->add_index('eventname_timecreated_idx', XMLDB_INDEX_NOTUNIQUE, ['eventname', 'timecreated']);
            $dbman->create_table($table);
        }

        $table = new xmldb_table('local_mpilot_rpt_total');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('bucket_start', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('login_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('session_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('submission_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('quiz_attempt_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('grade_event_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('course_view_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('module_view_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('completion_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('enrolment_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('forum_post_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('bucket_start_idx', XMLDB_INDEX_UNIQUE, ['bucket_start']);
            $dbman->create_table($table);
        }

        $table = new xmldb_table('local_mpilot_rpt_sync');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('sync_type', XMLDB_TYPE_CHAR, '64', null, XMLDB_NOTNULL, null, null);
            $table->add_field('snapshot_key', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('period_key', XMLDB_TYPE_CHAR, '100', null, null, null, null);
            $table->add_field('status', XMLDB_TYPE_CHAR, '32', null, XMLDB_NOTNULL, null, 'pending');
            $table->add_field('item_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('payload_hash', XMLDB_TYPE_CHAR, '64', null, null, null, null);
            $table->add_field('last_error', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table->add_field('started_at', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('completed_at', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('sync_type_started_idx', XMLDB_INDEX_NOTUNIQUE, ['sync_type', 'started_at']);
            $table->add_index('status_started_idx', XMLDB_INDEX_NOTUNIQUE, ['status', 'started_at']);
            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2026031900, 'local', 'moodlepilot_report');
    }

    if ($oldversion < 2026031901) {
        $table = new xmldb_table('local_mpilot_rpt_detail');
        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('page_type', XMLDB_TYPE_CHAR, '32', null, XMLDB_NOTNULL, null, null);
            $table->add_field('page_instance', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('page_label', XMLDB_TYPE_CHAR, '255', null, null, null, null);
            $table->add_field('bucket_start', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('visit_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('heartbeat_count', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('active_seconds', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('session_starts', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('first_access', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('last_access', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('useragent', XMLDB_TYPE_CHAR, '255', null, null, null, null);
            $table->add_field('userlang', XMLDB_TYPE_CHAR, '32', null, null, null, null);
            $table->add_field('userip', XMLDB_TYPE_CHAR, '64', null, null, null, null);
            $table->add_field('rolled_up_at', XMLDB_TYPE_INTEGER, '10', null, null, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('detail_bucket_idx', XMLDB_INDEX_UNIQUE, ['userid', 'page_type', 'page_instance', 'bucket_start']);
            $table->add_index('detail_rollup_idx', XMLDB_INDEX_NOTUNIQUE, ['rolled_up_at', 'bucket_start']);
            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2026031901, 'local', 'moodlepilot_report');
    }

    if ($oldversion < 2026032604) {
        if ($dbman->table_exists(new xmldb_table('local_mpilot_rpt_detail'))) {
            $DB->execute("UPDATE {local_mpilot_rpt_detail} SET useragent = '', userip = '' WHERE COALESCE(useragent, '') <> '' OR COALESCE(userip, '') <> ''");
        }

        if ($dbman->table_exists(new xmldb_table('local_mpilot_rpt_track'))) {
            $DB->execute("UPDATE {local_mpilot_rpt_track} SET useragent = '', userip = '' WHERE COALESCE(useragent, '') <> '' OR COALESCE(userip, '') <> ''");
        }

        if ($dbman->table_exists(new xmldb_table('local_mpilot_rpt_event'))) {
            $DB->execute(
                "UPDATE {local_mpilot_rpt_event} SET useragent = '', userip = '', metadata = ? WHERE COALESCE(useragent, '') <> '' OR COALESCE(userip, '') <> '' OR COALESCE(metadata, '') <> ''",
                ['{"redacted":true}']
            );
        }

        upgrade_plugin_savepoint(true, 2026032604, 'local', 'moodlepilot_report');
    }

    return true;
}
