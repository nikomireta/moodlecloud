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

namespace local_moodlepilot_report\local;

defined('MOODLE_INTERNAL') || die();

class analytics_repository {
    private const LAST_ACTIVITY_PREF = 'local_moodlepilot_report_last_activity_at';
    private const SESSION_TIMEOUT = 1800;

    public static function track_event(\core\event\base $event, array $overrides = []): void {
        global $DB;

        if (!bootstrap_config::plugin_enabled()) {
            return;
        }

        $userid = self::resolve_userid($event, $overrides);
        if ($userid <= 0) {
            return;
        }

        $timecreated = (int)($overrides['timecreated'] ?? $event->timecreated ?? time());
        $courseid = (int)($overrides['courseid'] ?? $event->courseid ?? 0);
        [$pagetype, $pageinstance, $pagelabel] = self::resolve_page_reference($event, $courseid, $overrides);
        $details = self::request_details();
        $sessionstarted = self::is_new_session($userid, $timecreated);
        $timespent = self::estimate_time_spent($userid, $timecreated, $sessionstarted);
        $metadata = self::build_metadata($event, $overrides);

        $transaction = $DB->start_delegated_transaction();

        self::insert_event_record($userid, $event, $courseid, $pagetype, $pageinstance, $metadata, $details, $timecreated);
        self::upsert_daily_totals($event, $sessionstarted, $timecreated);

        set_user_preference(self::LAST_ACTIVITY_PREF, $timecreated, $userid);

        $transaction->allow_commit();
    }

    public static function start_sync(string $synctype, string $snapshotkey, string $periodkey): int {
        global $DB;

        $now = time();
        $record = (object) [
            'sync_type' => trim($synctype),
            'snapshot_key' => trim($snapshotkey),
            'period_key' => trim($periodkey),
            'status' => 'running',
            'item_count' => 0,
            'payload_hash' => '',
            'last_error' => '',
            'started_at' => $now,
            'completed_at' => null,
            'timecreated' => $now,
            'timemodified' => $now,
        ];

        return (int)$DB->insert_record('local_mpilot_rpt_sync', $record, true);
    }

    public static function complete_sync(int $syncid, int $itemcount, string $payloadhash): void {
        global $DB;

        if ($syncid <= 0) {
            return;
        }

        $record = (object) [
            'id' => $syncid,
            'status' => 'completed',
            'item_count' => max(0, $itemcount),
            'payload_hash' => trim($payloadhash),
            'last_error' => '',
            'completed_at' => time(),
            'timemodified' => time(),
        ];
        $DB->update_record('local_mpilot_rpt_sync', $record);
    }

    public static function fail_sync(int $syncid, string $message): void {
        global $DB;

        if ($syncid <= 0) {
            return;
        }

        $record = (object) [
            'id' => $syncid,
            'status' => 'failed',
            'last_error' => trim($message),
            'completed_at' => time(),
            'timemodified' => time(),
        ];
        $DB->update_record('local_mpilot_rpt_sync', $record);
    }

    public static function count_snapshot_items(array $payload): int {
        $count = 0;
        foreach ($payload as $key => $value) {
            if ($key === 'summary_metrics' && is_array($value)) {
                $count += count($value);
                continue;
            }
            if (is_array($value)) {
                $count += count($value);
            }
        }
        return $count;
    }

    private static function resolve_userid(\core\event\base $event, array $overrides): int {
        $userid = (int)($overrides['userid'] ?? $event->userid ?? 0);
        if ($userid <= 0) {
            $userid = (int)($event->relateduserid ?? 0);
        }
        return $userid;
    }

    private static function resolve_page_reference(\core\event\base $event, int $courseid, array $overrides): array {
        $pagetype = trim((string)($overrides['page_type'] ?? ''));
        $pageinstance = (int)($overrides['page_instance'] ?? 0);
        $pagelabel = trim((string)($overrides['page_label'] ?? ''));

        if ($pagetype !== '') {
            if ($pageinstance <= 0 && $pagetype === 'course' && $courseid > 0) {
                $pageinstance = $courseid;
            }
            return [$pagetype, $pageinstance, $pagelabel];
        }

        $eventname = trim((string)$event->eventname);
        if ($eventname === '\core\event\user_loggedin') {
            return ['site', 0, $pagelabel];
        }
        if ($eventname === '\core\event\course_viewed' || $eventname === '\core\event\course_completed' || $eventname === '\core\event\user_enrolment_created') {
            return ['course', max($courseid, (int)$event->contextinstanceid), $pagelabel];
        }
        if (stripos($eventname, 'course_module') !== false || stripos((string)$event->target, 'course_module') !== false) {
            return ['module', max((int)$event->contextinstanceid, (int)$event->objectid), $pagelabel];
        }
        if ($courseid > 0) {
            return ['course', $courseid, $pagelabel];
        }
        return ['site', 0, $pagelabel];
    }

    private static function request_details(): array {
        $useragent = substr(trim((string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 255);
        $userip = substr(trim((string)($_SERVER['REMOTE_ADDR'] ?? '')), 0, 64);
        $userlang = substr(trim((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')), 0, 32);

        return [
            'useragent' => $useragent,
            'userip' => $userip,
            'userlang' => $userlang,
        ];
    }

    private static function is_new_session(int $userid, int $timecreated): bool {
        $lastactivity = (int)get_user_preferences(self::LAST_ACTIVITY_PREF, 0, $userid);
        if ($lastactivity <= 0) {
            return true;
        }
        return ($timecreated - $lastactivity) > self::SESSION_TIMEOUT;
    }

    private static function estimate_time_spent(int $userid, int $timecreated, bool $sessionstarted): int {
        if ($sessionstarted) {
            return 0;
        }
        $lastactivity = (int)get_user_preferences(self::LAST_ACTIVITY_PREF, 0, $userid);
        if ($lastactivity <= 0) {
            return 0;
        }
        $delta = $timecreated - $lastactivity;
        if ($delta <= 0) {
            return 0;
        }
        return min($delta, self::SESSION_TIMEOUT);
    }

    private static function build_metadata(\core\event\base $event, array $overrides): string {
        $payload = [
            'contextinstanceid' => (int)($event->contextinstanceid ?? 0),
            'contextid' => (int)($event->contextid ?? 0),
            'other' => $event->other ?? [],
            'overrides' => $overrides,
        ];

        $json = json_encode($payload);
        if ($json === false) {
            return '';
        }
        return $json;
    }

    private static function insert_event_record(int $userid, \core\event\base $event, int $courseid, string $pagetype, int $pageinstance, string $metadata, array $details, int $timecreated): void {
        global $DB;

        $record = (object) [
            'userid' => $userid,
            'relateduserid' => (int)($event->relateduserid ?? 0) ?: null,
            'courseid' => $courseid > 0 ? $courseid : null,
            'page_type' => $pagetype,
            'page_instance' => $pageinstance,
            'component' => trim((string)($event->component ?? '')),
            'action' => trim((string)($event->action ?? '')),
            'target' => trim((string)($event->target ?? '')),
            'eventname' => trim((string)$event->eventname),
            'objecttable' => trim((string)($event->objecttable ?? '')),
            'objectid' => (int)($event->objectid ?? 0) ?: null,
            'contextlevel' => (int)($event->contextlevel ?? 0) ?: null,
            'metadata' => $metadata,
            'useragent' => $details['useragent'],
            'userip' => $details['userip'],
            'timecreated' => $timecreated,
        ];

        $DB->insert_record('local_mpilot_rpt_event', $record);
    }

    private static function upsert_daily_totals(\core\event\base $event, bool $sessionstarted, int $timecreated): void {
        global $DB;

        $bucketstart = self::day_bucket($timecreated);
        $existing = $DB->get_record('local_mpilot_rpt_total', ['bucket_start' => $bucketstart]);
        $increments = self::event_counter_updates($event, $sessionstarted);

        if ($existing) {
            foreach ($increments as $field => $value) {
                $existing->{$field} = (int)$existing->{$field} + $value;
            }
            $existing->timemodified = $timecreated;
            $DB->update_record('local_mpilot_rpt_total', $existing);
            return;
        }

        $record = (object) [
            'bucket_start' => $bucketstart,
            'login_count' => 0,
            'session_count' => 0,
            'submission_count' => 0,
            'quiz_attempt_count' => 0,
            'grade_event_count' => 0,
            'course_view_count' => 0,
            'module_view_count' => 0,
            'completion_count' => 0,
            'enrolment_count' => 0,
            'forum_post_count' => 0,
            'timemodified' => $timecreated,
        ];
        foreach ($increments as $field => $value) {
            $record->{$field} = $value;
        }

        $DB->insert_record('local_mpilot_rpt_total', $record);
    }

    private static function event_counter_updates(\core\event\base $event, bool $sessionstarted): array {
        $eventname = trim((string)$event->eventname);
        $updates = [
            'session_count' => $sessionstarted ? 1 : 0,
        ];

        switch ($eventname) {
            case '\core\event\user_loggedin':
                $updates['login_count'] = 1;
                if ($updates['session_count'] === 0) {
                    $updates['session_count'] = 1;
                }
                break;
            case '\mod_assign\event\assessable_submitted':
                $updates['submission_count'] = 1;
                break;
            case '\mod_quiz\event\attempt_submitted':
                $updates['submission_count'] = 1;
                $updates['quiz_attempt_count'] = 1;
                break;
            case '\core\event\user_graded':
                $updates['grade_event_count'] = 1;
                break;
            case '\core\event\course_viewed':
                $updates['course_view_count'] = 1;
                break;
            case '\core\event\course_module_viewed':
            case '\mod_resource\event\course_module_viewed':
                $updates['module_view_count'] = 1;
                break;
            case '\core\event\course_module_completion_updated':
            case '\core\event\course_completed':
                $updates['completion_count'] = 1;
                break;
            case '\core\event\user_enrolment_created':
                $updates['enrolment_count'] = 1;
                break;
            case '\mod_forum\event\post_created':
                $updates['forum_post_count'] = 1;
                break;
        }

        return $updates;
    }
    private static function day_bucket(int $timecreated): int {
        return (int)strtotime(gmdate('Y-m-d 00:00:00', $timecreated));
    }
}
