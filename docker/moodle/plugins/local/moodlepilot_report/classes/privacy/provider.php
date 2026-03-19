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

namespace local_moodlepilot_report\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;
use core_privacy\local\metadata\provider as metadata_provider;

class provider implements metadata_provider {
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('local_mpilot_rpt_detail', [
            'userid' => 'privacy:metadata:userid',
            'courseid' => 'privacy:metadata:courseid',
            'page_type' => 'privacy:metadata:page_type',
            'page_instance' => 'privacy:metadata:page_instance',
            'page_label' => 'privacy:metadata:page_label',
            'bucket_start' => 'privacy:metadata:bucket_start',
            'visit_count' => 'privacy:metadata:visit_count',
            'heartbeat_count' => 'privacy:metadata:heartbeat_count',
            'active_seconds' => 'privacy:metadata:active_seconds',
            'session_starts' => 'privacy:metadata:session_starts',
            'first_access' => 'privacy:metadata:first_access',
            'last_access' => 'privacy:metadata:last_access',
            'useragent' => 'privacy:metadata:useragent',
            'userlang' => 'privacy:metadata:userlang',
            'userip' => 'privacy:metadata:userip',
            'rolled_up_at' => 'privacy:metadata:rolled_up_at',
            'timecreated' => 'privacy:metadata:timecreated',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:local_mpilot_rpt_detail');

        $collection->add_database_table('local_mpilot_rpt_track', [
            'userid' => 'privacy:metadata:userid',
            'courseid' => 'privacy:metadata:courseid',
            'page_type' => 'privacy:metadata:page_type',
            'page_instance' => 'privacy:metadata:page_instance',
            'page_label' => 'privacy:metadata:page_label',
            'visits' => 'privacy:metadata:visits',
            'session_starts' => 'privacy:metadata:session_starts',
            'time_spent' => 'privacy:metadata:time_spent',
            'first_access' => 'privacy:metadata:first_access',
            'last_access' => 'privacy:metadata:last_access',
            'useragent' => 'privacy:metadata:useragent',
            'userlang' => 'privacy:metadata:userlang',
            'userip' => 'privacy:metadata:userip',
            'timecreated' => 'privacy:metadata:timecreated',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:local_mpilot_rpt_track');

        $collection->add_database_table('local_mpilot_rpt_log', [
            'trackid' => 'privacy:metadata:trackid',
            'bucket_start' => 'privacy:metadata:bucket_start',
            'visits' => 'privacy:metadata:visits',
            'session_starts' => 'privacy:metadata:session_starts',
            'time_spent' => 'privacy:metadata:time_spent',
            'last_access' => 'privacy:metadata:last_access',
        ], 'privacy:metadata:local_mpilot_rpt_log');

        $collection->add_database_table('local_mpilot_rpt_event', [
            'userid' => 'privacy:metadata:userid',
            'relateduserid' => 'privacy:metadata:relateduserid',
            'courseid' => 'privacy:metadata:courseid',
            'page_type' => 'privacy:metadata:page_type',
            'page_instance' => 'privacy:metadata:page_instance',
            'component' => 'privacy:metadata:component',
            'action' => 'privacy:metadata:action',
            'target' => 'privacy:metadata:target',
            'eventname' => 'privacy:metadata:eventname',
            'objecttable' => 'privacy:metadata:objecttable',
            'objectid' => 'privacy:metadata:objectid',
            'contextlevel' => 'privacy:metadata:contextlevel',
            'metadata' => 'privacy:metadata:metadata',
            'useragent' => 'privacy:metadata:useragent',
            'userip' => 'privacy:metadata:userip',
            'timecreated' => 'privacy:metadata:timecreated',
        ], 'privacy:metadata:local_mpilot_rpt_event');

        $collection->add_database_table('local_mpilot_rpt_total', [
            'bucket_start' => 'privacy:metadata:bucket_start',
            'login_count' => 'privacy:metadata:login_count',
            'session_count' => 'privacy:metadata:session_count',
            'submission_count' => 'privacy:metadata:submission_count',
            'quiz_attempt_count' => 'privacy:metadata:quiz_attempt_count',
            'grade_event_count' => 'privacy:metadata:grade_event_count',
            'course_view_count' => 'privacy:metadata:course_view_count',
            'module_view_count' => 'privacy:metadata:module_view_count',
            'completion_count' => 'privacy:metadata:completion_count',
            'enrolment_count' => 'privacy:metadata:enrolment_count',
            'forum_post_count' => 'privacy:metadata:forum_post_count',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:local_mpilot_rpt_total');

        $collection->add_database_table('local_mpilot_rpt_sync', [
            'sync_type' => 'privacy:metadata:sync_type',
            'snapshot_key' => 'privacy:metadata:snapshot_key',
            'period_key' => 'privacy:metadata:period_key',
            'status' => 'privacy:metadata:status',
            'item_count' => 'privacy:metadata:item_count',
            'payload_hash' => 'privacy:metadata:payload_hash',
            'last_error' => 'privacy:metadata:last_error',
            'started_at' => 'privacy:metadata:started_at',
            'completed_at' => 'privacy:metadata:completed_at',
            'timecreated' => 'privacy:metadata:timecreated',
            'timemodified' => 'privacy:metadata:timemodified',
        ], 'privacy:metadata:local_mpilot_rpt_sync');

        return $collection;
    }
}
