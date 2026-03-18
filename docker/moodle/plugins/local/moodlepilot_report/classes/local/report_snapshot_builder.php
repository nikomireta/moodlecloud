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

class report_snapshot_builder {
    public static function build_last_7_days(): array {
        $periodend = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $periodstart = $periodend->sub(new \DateInterval('P7D'));

        $sessionstats = self::build_session_stats($periodstart->getTimestamp(), $periodend->getTimestamp());

        return [
            'snapshot_key' => 'reports_summary_v1',
            'period_key' => 'last_7_days',
            'period_start' => $periodstart->format(\DateTimeInterface::ATOM),
            'period_end' => $periodend->format(\DateTimeInterface::ATOM),
            'payload' => [
                'summary_metrics' => self::build_summary_metrics($periodstart->getTimestamp(), $periodend->getTimestamp(), $sessionstats),
                'recent_activity' => self::build_recent_activity($periodstart->getTimestamp(), $periodend->getTimestamp()),
                'course_completion_summary' => self::build_course_completion_summary(),
                'grade_recap_per_course' => self::build_grade_recap_per_course(),
                'user_activity_summary' => self::build_user_activity_summary($periodstart->getTimestamp(), $periodend->getTimestamp(), $sessionstats),
            ],
        ];
    }

    private static function build_summary_metrics(int $startts, int $endts, array $sessionstats): array {
        global $DB;

        $summary = [
            'login_count' => 0,
            'active_users' => 0,
            'submissions' => 0,
            'avg_online_seconds' => (int)($sessionstats['average_session_seconds'] ?? 0),
            'avg_online_label' => self::format_duration_label((int)($sessionstats['average_session_seconds'] ?? 0)),
        ];

        if (self::table_exists('logstore_standard_log')) {
            $summary['login_count'] = (int)$DB->count_records_select('logstore_standard_log', 'userid > 0 AND timecreated BETWEEN ? AND ? AND target = ? AND action = ?', [
                $startts,
                $endts,
                'user',
                'loggedin',
            ]);

            $activesql = 'SELECT COUNT(DISTINCT userid) FROM {logstore_standard_log} WHERE userid > 0 AND timecreated BETWEEN ? AND ?';
            $summary['active_users'] = (int)$DB->count_records_sql($activesql, [$startts, $endts]);
        }

        if (self::table_exists('assign_submission')) {
            $summary['submissions'] = (int)$DB->count_records_select('assign_submission', 'userid > 0 AND timemodified BETWEEN ? AND ? AND status = ?', [
                $startts,
                $endts,
                'submitted',
            ]);
        }

        return $summary;
    }

    private static function build_recent_activity(int $startts, int $endts): array {
        global $DB;

        if (!self::table_exists('logstore_standard_log')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                l.id,
                l.userid,
                l.action,
                l.target,
                l.component,
                l.timecreated,
                COALESCE(l.ip, '') AS ip,
                COALESCE(u.firstname, '') AS firstname,
                COALESCE(u.lastname, '') AS lastname,
                COALESCE(c.fullname, '') AS coursefullname
            FROM {logstore_standard_log} l
            JOIN {user} u ON u.id = l.userid
            LEFT JOIN {course} c ON c.id = l.courseid
            WHERE l.userid > 0
              AND l.timecreated BETWEEN ? AND ?
            ORDER BY l.timecreated DESC
        ", [$startts, $endts], 0, 20);

        $items = [];
        foreach ($records as $record) {
            $items[] = [
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'action' => self::humanize_log_action($record->action, $record->target, $record->component, $record->coursefullname),
                'occurred_at' => gmdate(\DateTimeInterface::ATOM, (int)$record->timecreated),
                'ip_address' => trim((string)$record->ip),
            ];
        }

        return $items;
    }

    private static function build_course_completion_summary(): array {
        global $DB;

        if (!self::table_exists('course_completions')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                c.id,
                c.fullname,
                COUNT(DISTINCT ue.userid) AS enrolled,
                COUNT(DISTINCT CASE WHEN cc.timecompleted IS NOT NULL AND cc.timecompleted > 0 THEN cc.userid END) AS completed,
                COUNT(DISTINCT CASE WHEN (cc.timecompleted IS NULL OR cc.timecompleted = 0) AND cc.timestarted > 0 THEN cc.userid END) AS inprogress,
                COUNT(DISTINCT CASE WHEN (cc.timecompleted IS NULL OR cc.timecompleted = 0) AND (cc.timestarted IS NULL OR cc.timestarted = 0) THEN cc.userid END) AS notstarted
            FROM {course} c
            JOIN {enrol} e ON e.courseid = c.id AND e.status = 0
            JOIN {user_enrolments} ue ON ue.enrolid = e.id AND ue.status = 0
            LEFT JOIN {course_completions} cc ON cc.course = c.id AND cc.userid = ue.userid
            WHERE c.id <> 1
            GROUP BY c.id, c.fullname
            HAVING COUNT(DISTINCT ue.userid) > 0
            ORDER BY COUNT(DISTINCT ue.userid) DESC, c.fullname ASC
        ", [], 0, 20);

        $items = [];
        foreach ($records as $record) {
            $enrolled = (int)$record->enrolled;
            $completed = (int)$record->completed;
            $items[] = [
                'course_id' => (int)$record->id,
                'course_name' => trim((string)$record->fullname),
                'enrolled' => $enrolled,
                'completed' => $completed,
                'in_progress' => (int)$record->inprogress,
                'not_started' => (int)$record->notstarted,
                'completion_rate' => $enrolled > 0 ? (int)round(($completed / $enrolled) * 100) : 0,
            ];
        }

        return $items;
    }

    private static function build_grade_recap_per_course(): array {
        global $DB;

        if (!self::table_exists('grade_items') || !self::table_exists('grade_grades')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                c.id,
                c.fullname,
                ROUND(COALESCE(AVG(gg.finalgrade), 0)::numeric, 1) AS averagegrade,
                ROUND(COALESCE(MAX(gg.finalgrade), 0)::numeric, 1) AS highestgrade,
                ROUND(COALESCE(MIN(gg.finalgrade), 0)::numeric, 1) AS lowestgrade,
                SUM(CASE
                    WHEN gg.finalgrade IS NOT NULL AND gg.finalgrade >= CASE WHEN gi.gradepass > 0 THEN gi.gradepass ELSE 60 END
                    THEN 1 ELSE 0
                END) AS passedcount,
                SUM(CASE
                    WHEN gg.finalgrade IS NOT NULL AND gg.finalgrade < CASE WHEN gi.gradepass > 0 THEN gi.gradepass ELSE 60 END
                    THEN 1 ELSE 0
                END) AS failedcount
            FROM {grade_items} gi
            JOIN {course} c ON c.id = gi.courseid
            LEFT JOIN {grade_grades} gg ON gg.itemid = gi.id AND gg.finalgrade IS NOT NULL
            WHERE gi.itemtype = 'course'
              AND c.id <> 1
            GROUP BY c.id, c.fullname, gi.gradepass
            ORDER BY c.fullname ASC
        ", [], 0, 20);

        $items = [];
        foreach ($records as $record) {
            $items[] = [
                'course_id' => (int)$record->id,
                'course_name' => trim((string)$record->fullname),
                'average_grade' => (float)$record->averagegrade,
                'highest_grade' => (float)$record->highestgrade,
                'lowest_grade' => (float)$record->lowestgrade,
                'passed' => (int)$record->passedcount,
                'failed' => (int)$record->failedcount,
            ];
        }

        return $items;
    }

    private static function build_user_activity_summary(int $startts, int $endts, array $sessionstats): array {
        global $DB;

        if (!self::table_exists('logstore_standard_log')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                u.id,
                u.firstname,
                u.lastname,
                MAX(l.timecreated) AS lastaction
            FROM {user} u
            JOIN {logstore_standard_log} l ON l.userid = u.id AND l.timecreated BETWEEN ? AND ?
            WHERE u.deleted = 0
              AND u.suspended = 0
              AND u.id > 0
            GROUP BY u.id, u.firstname, u.lastname
            ORDER BY MAX(l.timecreated) DESC
        ", [$startts, $endts], 0, 20);

        $userids = array_map(static function($record) {
            return (int)$record->id;
        }, array_values($records));

        $rolemap = self::build_user_role_map($userids);
        $submissionmap = self::build_user_submission_map($userids, $startts, $endts);
        $peruserstats = $sessionstats['per_user'] ?? [];

        $items = [];
        foreach ($records as $record) {
            $userid = (int)$record->id;
            $stats = $peruserstats[$userid] ?? ['sessions' => 0, 'total_online_seconds' => 0];
            $totalseconds = (int)($stats['total_online_seconds'] ?? 0);
            $items[] = [
                'user_id' => $userid,
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'role_label' => self::role_label($rolemap[$userid] ?? []),
                'sessions' => (int)($stats['sessions'] ?? 0),
                'total_online_seconds' => $totalseconds,
                'total_online_label' => self::format_duration_label($totalseconds),
                'submissions' => (int)($submissionmap[$userid] ?? 0),
                'last_action_at' => gmdate(\DateTimeInterface::ATOM, (int)$record->lastaction),
            ];
        }

        return $items;
    }

    private static function build_session_stats(int $startts, int $endts): array {
        global $DB;

        $result = [
            'average_session_seconds' => 0,
            'per_user' => [],
        ];

        if (!self::table_exists('logstore_standard_log')) {
            return $result;
        }

        $recordset = $DB->get_recordset_select('logstore_standard_log', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts], 'userid ASC, timecreated ASC', 'userid, timecreated');

        $currentuserid = 0;
        $sessionstart = 0;
        $lasttime = 0;
        $totalsessions = 0;
        $totalseconds = 0;

        foreach ($recordset as $record) {
            $userid = (int)$record->userid;
            $timecreated = (int)$record->timecreated;

            if ($userid !== $currentuserid || $lasttime === 0 || ($timecreated - $lasttime) > 1800) {
                if ($currentuserid > 0 && $sessionstart > 0 && $lasttime > 0) {
                    $duration = max(60, $lasttime - $sessionstart);
                    $totalsessions++;
                    $totalseconds += $duration;
                    self::add_user_session_stat($result['per_user'], $currentuserid, $duration, $lasttime);
                }
                $currentuserid = $userid;
                $sessionstart = $timecreated;
            }

            $lasttime = $timecreated;
        }
        $recordset->close();

        if ($currentuserid > 0 && $sessionstart > 0 && $lasttime > 0) {
            $duration = max(60, $lasttime - $sessionstart);
            $totalsessions++;
            $totalseconds += $duration;
            self::add_user_session_stat($result['per_user'], $currentuserid, $duration, $lasttime);
        }

        if ($totalsessions > 0) {
            $result['average_session_seconds'] = (int)round($totalseconds / $totalsessions);
        }

        return $result;
    }

    private static function add_user_session_stat(array &$peruser, int $userid, int $duration, int $lastactivity): void {
        if (!isset($peruser[$userid])) {
            $peruser[$userid] = [
                'sessions' => 0,
                'total_online_seconds' => 0,
                'last_activity' => 0,
            ];
        }

        $peruser[$userid]['sessions']++;
        $peruser[$userid]['total_online_seconds'] += $duration;
        $peruser[$userid]['last_activity'] = max((int)$peruser[$userid]['last_activity'], $lastactivity);
    }

    private static function build_user_role_map(array $userids): array {
        global $DB;

        if (empty($userids) || !self::table_exists('role_assignments') || !self::table_exists('role')) {
            return [];
        }

        [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
        $records = $DB->get_records_sql("
            SELECT ra.userid, r.shortname
            FROM {role_assignments} ra
            JOIN {role} r ON r.id = ra.roleid
            WHERE ra.userid $insql
        ", $params);

        $roles = [];
        foreach ($records as $record) {
            $userid = (int)$record->userid;
            if (!isset($roles[$userid])) {
                $roles[$userid] = [];
            }
            $roles[$userid][] = trim((string)$record->shortname);
        }

        return $roles;
    }

    private static function build_user_submission_map(array $userids, int $startts, int $endts): array {
        global $DB;

        if (empty($userids) || !self::table_exists('assign_submission')) {
            return [];
        }

        [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
        $records = $DB->get_records_sql("
            SELECT userid, COUNT(*) AS total
            FROM {assign_submission}
            WHERE userid $insql
              AND timemodified BETWEEN ? AND ?
              AND status = 'submitted'
            GROUP BY userid
        ", array_merge($params, [$startts, $endts]));

        $counts = [];
        foreach ($records as $record) {
            $counts[(int)$record->userid] = (int)$record->total;
        }

        return $counts;
    }

    private static function table_exists(string $tablename): bool {
        global $DB;

        $table = new \xmldb_table($tablename);
        return $DB->get_manager()->table_exists($table);
    }

    private static function humanize_log_action(string $action, string $target, string $component, string $coursefullname): string {
        $action = trim($action);
        $target = trim($target);
        $component = trim($component);
        $coursefullname = trim($coursefullname);

        if ($action === 'loggedin' && $target === 'user') {
            return 'Login ke sistem';
        }
        if ($action === 'viewed' && $target === 'course' && $coursefullname !== '') {
            return 'Mengakses kursus ' . $coursefullname;
        }
        if ($action === 'submitted' && $component === 'mod_assign') {
            return $coursefullname !== '' ? 'Mengumpulkan tugas - ' . $coursefullname : 'Mengumpulkan tugas';
        }
        if ($action === 'created' && $target === 'course_module') {
            return $coursefullname !== '' ? 'Membuat aktivitas baru - ' . $coursefullname : 'Membuat aktivitas baru';
        }
        if ($action === 'viewed' && $target === 'course_module') {
            return $coursefullname !== '' ? 'Mengakses aktivitas - ' . $coursefullname : 'Mengakses aktivitas';
        }
        if ($coursefullname !== '') {
            return ucfirst($action) . ' ' . str_replace('_', ' ', $target) . ' - ' . $coursefullname;
        }
        return ucfirst($action) . ' ' . str_replace('_', ' ', $target);
    }

    private static function role_label(array $roles): string {
        $normalized = array_map(static function(string $role): string {
            return strtolower(trim($role));
        }, $roles);

        if (in_array('manager', $normalized, true) || in_array('admin', $normalized, true)) {
            return 'Admin';
        }
        if (in_array('editingteacher', $normalized, true) || in_array('teacher', $normalized, true)) {
            return 'Guru';
        }
        if (in_array('student', $normalized, true)) {
            return 'Siswa';
        }
        if (!empty($roles)) {
            return ucfirst(str_replace('_', ' ', $roles[0]));
        }
        return 'Pengguna';
    }

    private static function format_duration_label(int $seconds): string {
        if ($seconds <= 0) {
            return '0 m';
        }

        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);

        if ($hours > 0) {
            return trim($hours . ' j ' . $minutes . ' m');
        }
        if ($minutes > 0) {
            return $minutes . ' m';
        }
        return max(1, (int)round($seconds / 60)) . ' m';
    }
}
