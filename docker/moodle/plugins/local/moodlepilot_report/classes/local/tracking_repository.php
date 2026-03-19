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

class tracking_repository {
    private const LAST_BROWSER_ACTIVITY_PREF = 'local_moodlepilot_report_last_browser_activity_at';
    private const SESSION_TIMEOUT = 1800;
    private const DETAIL_BUCKET_SECONDS = 300;

    public static function track_browser_heartbeat(array $payload): string {
        global $DB, $USER;

        if (empty($USER->id) || !bootstrap_config::plugin_enabled()) {
            return '';
        }

        $userid = (int)$USER->id;
        $observedat = self::normalize_observed_at((int)($payload['observed_at'] ?? 0));
        $pagetype = self::normalize_page_type((string)($payload['page_type'] ?? 'site'));
        $pageinstance = self::normalize_page_instance($pagetype, (int)($payload['page_instance'] ?? 0));
        $courseid = max(0, (int)($payload['course_id'] ?? 0));
        if ($pagetype === 'course' && $courseid <= 0) {
            $courseid = $pageinstance;
        }

        $pagelabel = trim((string)($payload['page_label'] ?? ''));
        if ($pagelabel === '') {
            $pagelabel = $pagetype;
        }
        $pagelabel = substr($pagelabel, 0, 255);

        $visitdelta = max(0, min(1, (int)($payload['visit_delta'] ?? 0)));
        $activeseconds = max(0, min(300, (int)($payload['active_seconds'] ?? 0)));
        $sessionstarts = self::is_new_session($userid, $observedat) ? 1 : 0;
        $details = self::request_details();
        $bucketstart = self::detail_bucket($observedat);

        $record = $DB->get_record('local_mpilot_rpt_detail', [
            'userid' => $userid,
            'page_type' => $pagetype,
            'page_instance' => $pageinstance,
            'bucket_start' => $bucketstart,
        ]);

        if ($record) {
            $record->courseid = $record->courseid ?: ($courseid > 0 ? $courseid : null);
            $record->page_label = $pagelabel;
            $record->visit_count = (int)$record->visit_count + $visitdelta;
            $record->heartbeat_count = (int)$record->heartbeat_count + 1;
            $record->active_seconds = (int)$record->active_seconds + $activeseconds;
            $record->session_starts = (int)$record->session_starts + $sessionstarts;
            $record->first_access = self::min_timestamp((int)$record->first_access, $observedat);
            $record->last_access = max((int)$record->last_access, $observedat);
            $record->useragent = $details['useragent'];
            $record->userlang = $details['userlang'];
            $record->userip = $details['userip'];
            $record->timemodified = $observedat;
            $DB->update_record('local_mpilot_rpt_detail', $record);
        } else {
            $DB->insert_record('local_mpilot_rpt_detail', (object) [
                'userid' => $userid,
                'courseid' => $courseid > 0 ? $courseid : null,
                'page_type' => $pagetype,
                'page_instance' => $pageinstance,
                'page_label' => $pagelabel,
                'bucket_start' => $bucketstart,
                'visit_count' => $visitdelta,
                'heartbeat_count' => 1,
                'active_seconds' => $activeseconds,
                'session_starts' => $sessionstarts,
                'first_access' => $observedat,
                'last_access' => $observedat,
                'useragent' => $details['useragent'],
                'userlang' => $details['userlang'],
                'userip' => $details['userip'],
                'rolled_up_at' => null,
                'timecreated' => $observedat,
                'timemodified' => $observedat,
            ]);
        }

        set_user_preference(self::LAST_BROWSER_ACTIVITY_PREF, $observedat, $userid);

        $lastseen = gmdate(\DateTimeInterface::ATOM, $observedat);
        set_config('tracking_mode', bootstrap_config::tracking_mode(), 'local_moodlepilot_report');
        set_config('last_tracking_seen_at', $lastseen, 'local_moodlepilot_report');

        return $lastseen;
    }

    public static function process_pending_detail_rows(int $limit = 1000): int {
        global $DB;

        $records = $DB->get_records_select(
            'local_mpilot_rpt_detail',
            'rolled_up_at IS NULL',
            null,
            'bucket_start ASC, id ASC',
            '*',
            0,
            max(1, $limit)
        );
        if (!$records) {
            return 0;
        }

        $now = time();
        $count = 0;
        $transaction = $DB->start_delegated_transaction();

        foreach ($records as $record) {
            $trackid = self::upsert_tracking_record($record);
            self::upsert_tracking_log($trackid, $record);
            $record->rolled_up_at = $now;
            $record->timemodified = $now;
            $DB->update_record('local_mpilot_rpt_detail', $record);
            $count++;
        }

        $transaction->allow_commit();

        if ($count > 0) {
            set_config('last_rollup_at', gmdate(\DateTimeInterface::ATOM, $now), 'local_moodlepilot_report');
        }

        return $count;
    }

    public static function pending_detail_count(): int {
        global $DB;

        return (int)$DB->count_records_select('local_mpilot_rpt_detail', 'rolled_up_at IS NULL');
    }

    private static function upsert_tracking_record(\stdClass $detail): int {
        global $DB;

        $existing = $DB->get_record('local_mpilot_rpt_track', [
            'userid' => (int)$detail->userid,
            'page_type' => trim((string)$detail->page_type),
            'page_instance' => (int)$detail->page_instance,
        ]);

        if ($existing) {
            $existing->courseid = $existing->courseid ?: ((int)$detail->courseid > 0 ? (int)$detail->courseid : null);
            if (trim((string)$detail->page_label) !== '') {
                $existing->page_label = trim((string)$detail->page_label);
            }
            $existing->visits = (int)$existing->visits + (int)$detail->visit_count;
            $existing->session_starts = (int)$existing->session_starts + (int)$detail->session_starts;
            $existing->time_spent = (int)$existing->time_spent + (int)$detail->active_seconds;
            $existing->first_access = self::min_timestamp((int)$existing->first_access, (int)$detail->first_access);
            $existing->last_access = max((int)$existing->last_access, (int)$detail->last_access);
            $existing->useragent = trim((string)$detail->useragent);
            $existing->userlang = trim((string)$detail->userlang);
            $existing->userip = trim((string)$detail->userip);
            $existing->timemodified = max((int)$detail->last_access, time());
            $DB->update_record('local_mpilot_rpt_track', $existing);
            return (int)$existing->id;
        }

        return (int)$DB->insert_record('local_mpilot_rpt_track', (object) [
            'userid' => (int)$detail->userid,
            'courseid' => (int)$detail->courseid > 0 ? (int)$detail->courseid : null,
            'page_type' => trim((string)$detail->page_type),
            'page_instance' => (int)$detail->page_instance,
            'page_label' => trim((string)$detail->page_label) !== '' ? trim((string)$detail->page_label) : null,
            'visits' => (int)$detail->visit_count,
            'session_starts' => (int)$detail->session_starts,
            'time_spent' => (int)$detail->active_seconds,
            'first_access' => (int)$detail->first_access,
            'last_access' => (int)$detail->last_access,
            'useragent' => trim((string)$detail->useragent),
            'userlang' => trim((string)$detail->userlang),
            'userip' => trim((string)$detail->userip),
            'timecreated' => (int)$detail->timecreated,
            'timemodified' => (int)$detail->last_access,
        ], true);
    }

    private static function upsert_tracking_log(int $trackid, \stdClass $detail): void {
        global $DB;

        $bucketstart = self::hour_bucket((int)$detail->bucket_start);
        $existing = $DB->get_record('local_mpilot_rpt_log', [
            'trackid' => $trackid,
            'bucket_start' => $bucketstart,
        ]);

        if ($existing) {
            $existing->visits = (int)$existing->visits + (int)$detail->visit_count;
            $existing->session_starts = (int)$existing->session_starts + (int)$detail->session_starts;
            $existing->time_spent = (int)$existing->time_spent + (int)$detail->active_seconds;
            $existing->last_access = max((int)$existing->last_access, (int)$detail->last_access);
            $DB->update_record('local_mpilot_rpt_log', $existing);
            return;
        }

        $DB->insert_record('local_mpilot_rpt_log', (object) [
            'trackid' => $trackid,
            'bucket_start' => $bucketstart,
            'visits' => (int)$detail->visit_count,
            'session_starts' => (int)$detail->session_starts,
            'time_spent' => (int)$detail->active_seconds,
            'last_access' => (int)$detail->last_access,
        ]);
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

    private static function is_new_session(int $userid, int $observedat): bool {
        $lastactivity = (int)get_user_preferences(self::LAST_BROWSER_ACTIVITY_PREF, 0, $userid);
        if ($lastactivity <= 0) {
            return true;
        }
        return ($observedat - $lastactivity) > self::SESSION_TIMEOUT;
    }

    private static function normalize_observed_at(int $observedat): int {
        $now = time();
        if ($observedat <= 0) {
            return $now;
        }
        if ($observedat > ($now + 300) || $observedat < ($now - 86400)) {
            return $now;
        }
        return $observedat;
    }

    private static function normalize_page_type(string $pagetype): string {
        $pagetype = strtolower(trim($pagetype));
        if (in_array($pagetype, ['course', 'module'], true)) {
            return $pagetype;
        }
        return 'site';
    }

    private static function normalize_page_instance(string $pagetype, int $pageinstance): int {
        if ($pagetype === 'site') {
            return 0;
        }
        return max(0, $pageinstance);
    }

    private static function detail_bucket(int $timecreated): int {
        return (int)(floor($timecreated / self::DETAIL_BUCKET_SECONDS) * self::DETAIL_BUCKET_SECONDS);
    }

    private static function hour_bucket(int $timecreated): int {
        return (int)strtotime(gmdate('Y-m-d H:00:00', $timecreated));
    }

    private static function min_timestamp(int $current, int $candidate): int {
        if ($current <= 0) {
            return $candidate;
        }
        if ($candidate <= 0) {
            return $current;
        }
        return min($current, $candidate);
    }
}
