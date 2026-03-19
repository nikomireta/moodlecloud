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
    private const SUPPORTED_PERIOD_KEYS = [
        'last_7_days',
        'last_30_days',
        'this_month',
        'last_month',
    ];

    public static function build_supported_snapshots(): array {
        $snapshots = [];
        foreach (self::SUPPORTED_PERIOD_KEYS as $periodkey) {
            $snapshots[] = self::build_snapshot($periodkey);
        }
        return $snapshots;
    }

    public static function build_last_7_days(): array {
        return self::build_snapshot('last_7_days');
    }

    public static function build_snapshot(string $periodkey): array {
        [$periodstart, $periodend, $normalizedperiodkey] = self::resolve_period_range($periodkey);
        $sessionstats = self::build_session_stats($periodstart->getTimestamp(), $periodend->getTimestamp());

        return [
            'snapshot_key' => 'reports_summary_v1',
            'period_key' => $normalizedperiodkey,
            'period_start' => $periodstart->format(\DateTimeInterface::ATOM),
            'period_end' => $periodend->format(\DateTimeInterface::ATOM),
            'payload' => [
                'summary_metrics' => self::build_summary_metrics($periodstart->getTimestamp(), $periodend->getTimestamp(), $sessionstats),
                'recent_activity' => self::build_recent_activity($periodstart->getTimestamp(), $periodend->getTimestamp()),
                'course_completion_summary' => self::build_course_completion_summary($periodstart->getTimestamp(), $periodend->getTimestamp()),
                'grade_recap_per_course' => self::build_grade_recap_per_course($periodstart->getTimestamp(), $periodend->getTimestamp()),
                'user_activity_summary' => self::build_user_activity_summary($periodstart->getTimestamp(), $periodend->getTimestamp(), $sessionstats),
                'user_status' => self::build_user_status($periodstart->getTimestamp(), $periodend->getTimestamp(), $sessionstats),
                'activity_stats_summary' => self::build_activity_stats_summary($periodstart->getTimestamp(), $periodend->getTimestamp()),
                'quiz_activity_detail' => self::build_quiz_activity_detail($periodstart->getTimestamp(), $periodend->getTimestamp()),
            ],
        ];
    }

    private static function resolve_period_range(string $periodkey): array {
        $periodend = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $normalizedperiodkey = strtolower(trim($periodkey));

        switch ($normalizedperiodkey) {
            case 'last_30_days':
                $periodstart = $periodend->sub(new \DateInterval('P30D'));
                break;
            case 'this_month':
                $periodstart = $periodend->modify('first day of this month')->setTime(0, 0, 0);
                break;
            case 'last_month':
                $periodstart = $periodend->modify('first day of last month')->setTime(0, 0, 0);
                $periodend = $periodend->modify('first day of this month')->setTime(0, 0, 0);
                break;
            case 'last_7_days':
            default:
                $normalizedperiodkey = 'last_7_days';
                $periodstart = $periodend->sub(new \DateInterval('P7D'));
                break;
        }

        return [$periodstart, $periodend, $normalizedperiodkey];
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

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $summary['login_count'] = (int)$DB->count_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ? AND eventname = ?', [
                $startts,
                $endts,
                '\core\event\user_loggedin',
            ]);
            [$eventsql, $eventparams] = $DB->get_in_or_equal([
                '\mod_assign\event\assessable_submitted',
                '\mod_quiz\event\attempt_submitted',
            ], SQL_PARAMS_QM);
            $summary['submissions'] = (int)$DB->count_records_sql("
                SELECT COUNT(*)
                FROM {local_mpilot_rpt_event}
                WHERE userid > 0
                  AND eventname $eventsql
                  AND timecreated BETWEEN ? AND ?
            ", array_merge($eventparams, [$startts, $endts]));
            $activesql = 'SELECT COUNT(DISTINCT userid) FROM {local_mpilot_rpt_event} WHERE userid > 0 AND timecreated BETWEEN ? AND ?';
            $summary['active_users'] = (int)$DB->count_records_sql($activesql, [$startts, $endts]);
            return $summary;
        }

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

        $records = [];
        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_records_sql("
                SELECT
                    e.id,
                    e.userid,
                    e.action,
                    e.target,
                    e.component,
                    e.timecreated,
                    COALESCE(e.userip, '') AS ip,
                    COALESCE(u.firstname, '') AS firstname,
                    COALESCE(u.lastname, '') AS lastname,
                    COALESCE(c.fullname, '') AS coursefullname
                FROM {local_mpilot_rpt_event} e
                JOIN {user} u ON u.id = e.userid
                LEFT JOIN {course} c ON c.id = e.courseid
                WHERE e.userid > 0
                  AND e.timecreated BETWEEN ? AND ?
                ORDER BY e.timecreated DESC
            ", [$startts, $endts], 0, 20);
        } else if (self::table_exists('logstore_standard_log')) {
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
        }

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

    private static function build_course_completion_summary(int $startts, int $endts): array {
        global $DB;

        if (!self::table_exists('course_completions')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                c.id,
                c.fullname,
                COUNT(DISTINCT ue.userid) AS enrolled,
                COUNT(DISTINCT CASE WHEN cc.timecompleted IS NOT NULL AND cc.timecompleted > 0 THEN ue.userid END) AS completed,
                COUNT(DISTINCT CASE
                    WHEN cc.id IS NOT NULL
                     AND (cc.timecompleted IS NULL OR cc.timecompleted = 0)
                     AND (cc.timestarted > 0 OR trackagg.userid IS NOT NULL)
                    THEN ue.userid
                END) AS inprogress,
                COUNT(DISTINCT CASE
                    WHEN cc.id IS NULL
                      OR (
                        (cc.timecompleted IS NULL OR cc.timecompleted = 0)
                        AND (cc.timestarted IS NULL OR cc.timestarted = 0)
                        AND trackagg.userid IS NULL
                      )
                    THEN ue.userid
                END) AS notstarted
            FROM {course} c
            JOIN {enrol} e ON e.courseid = c.id AND e.status = 0
            JOIN {user_enrolments} ue ON ue.enrolid = e.id AND ue.status = 0
            LEFT JOIN {course_completions} cc ON cc.course = c.id AND cc.userid = ue.userid
            LEFT JOIN (
                SELECT DISTINCT userid, courseid
                FROM {local_mpilot_rpt_track}
                WHERE courseid > 0
                  AND last_access BETWEEN ? AND ?
            ) trackagg ON trackagg.userid = ue.userid AND trackagg.courseid = c.id
            WHERE c.id <> 1
            GROUP BY c.id, c.fullname
            HAVING COUNT(DISTINCT ue.userid) > 0
            ORDER BY COUNT(DISTINCT ue.userid) DESC, c.fullname ASC
        ", [$startts, $endts], 0, 20);

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

    private static function build_grade_recap_per_course(int $startts, int $endts): array {
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
            LEFT JOIN {grade_grades} gg
              ON gg.itemid = gi.id
             AND gg.finalgrade IS NOT NULL
             AND gg.timemodified BETWEEN ? AND ?
            WHERE gi.itemtype = 'course'
              AND c.id <> 1
            GROUP BY c.id, c.fullname, gi.gradepass
            ORDER BY c.fullname ASC
        ", [$startts, $endts], 0, 20);

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

        $records = [];
        if (self::table_has_records_select('local_mpilot_rpt_track', 'userid > 0 AND last_access BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_records_sql("
                SELECT
                    u.id,
                    u.firstname,
                    u.lastname,
                    MAX(t.last_access) AS lastaction
                FROM {user} u
                JOIN {local_mpilot_rpt_track} t ON t.userid = u.id AND t.last_access BETWEEN ? AND ?
                WHERE u.deleted = 0
                  AND u.suspended = 0
                  AND u.id > 0
                GROUP BY u.id, u.firstname, u.lastname
                ORDER BY MAX(t.last_access) DESC
            ", [$startts, $endts], 0, 20);
        } else if (self::table_exists('logstore_standard_log')) {
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
        } else {
            return [];
        }

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

    private static function build_user_status(int $startts, int $endts, array $sessionstats): array {
        global $DB;

        if (!self::table_exists('user_enrolments') || !self::table_exists('enrol')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                u.id AS userid,
                u.firstname,
                u.lastname,
                COALESCE(u.username, '') AS username,
                COALESCE(u.email, '') AS email,
                c.id AS courseid,
                c.fullname AS coursefullname,
                COALESCE(c.shortname, '') AS courseshortname,
                COALESCE(e.enrol, '') AS enrolmethod,
                ue.timecreated AS enrolledon,
                CASE
                    WHEN cc.timecompleted IS NOT NULL AND cc.timecompleted > 0 THEN 'completed'
                    WHEN cc.timestarted IS NOT NULL AND cc.timestarted > 0 THEN 'in_progress'
                    ELSE 'not_started'
                END AS statuskey,
                ROUND(COALESCE(cgg.finalgrade, 0)::numeric, 1) AS averagegrade,
                MAX(COALESCE(t.last_access, 0)) AS lastaction
            FROM {user} u
            JOIN {user_enrolments} ue ON ue.userid = u.id AND ue.status = 0
            JOIN {enrol} e ON e.id = ue.enrolid AND e.status = 0 AND e.courseid <> 1
            JOIN {course} c ON c.id = e.courseid
            LEFT JOIN {course_completions} cc ON cc.userid = u.id AND cc.course = c.id
            LEFT JOIN {grade_items} gi ON gi.courseid = c.id AND gi.itemtype = 'course'
            LEFT JOIN {grade_grades} cgg ON cgg.itemid = gi.id AND cgg.userid = u.id AND cgg.finalgrade IS NOT NULL
            LEFT JOIN {local_mpilot_rpt_track} t
                ON t.userid = u.id
               AND (t.courseid = c.id OR (t.page_type = 'course' AND t.page_instance = c.id))
               AND t.last_access BETWEEN ? AND ?
            WHERE u.deleted = 0
              AND u.suspended = 0
              AND u.id > 0
            GROUP BY
                u.id, u.firstname, u.lastname, u.username, u.email,
                c.id, c.fullname, c.shortname, e.enrol, ue.timecreated,
                cc.timecompleted, cc.timestarted, cgg.finalgrade
            ORDER BY MAX(COALESCE(t.last_access, 0)) DESC,
                     ue.timecreated DESC,
                     u.lastname ASC,
                     u.firstname ASC
        ", [$startts, $endts], 0, 20);

        $userids = array_map(static function($record) {
            return (int)$record->userid;
        }, array_values($records));

        $rolemap = self::build_user_role_map($userids);

        $items = [];
        foreach ($records as $record) {
            $userid = (int)$record->userid;
            $lastactivity = (int)$record->lastaction;
            $items[] = [
                'user_id' => $userid,
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'username' => trim((string)$record->username),
                'email' => trim((string)$record->email),
                'role_label' => self::role_label($rolemap[$userid] ?? []),
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'course_short_name' => trim((string)$record->courseshortname),
                'enrolment_method' => trim((string)$record->enrolmethod),
                'enrolment_method_label' => self::humanize_enrolment_method((string)$record->enrolmethod),
                'enrolled_on' => (int)$record->enrolledon > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->enrolledon) : '',
                'status_key' => trim((string)$record->statuskey),
                'status_label' => self::humanize_status_key((string)$record->statuskey),
                'average_grade' => (float)$record->averagegrade,
                'last_action_at' => $lastactivity > 0 ? gmdate(\DateTimeInterface::ATOM, $lastactivity) : '',
            ];
        }

        return $items;
    }

    private static function build_activity_stats_summary(int $startts, int $endts): array {
        global $DB;

        $items = [];

        if (self::table_exists('local_mpilot_rpt_log') && self::table_exists('course_modules') && self::table_has_records_select('local_mpilot_rpt_log', 'bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_records_sql("
                SELECT
                    c.id AS courseid,
                    c.fullname AS coursefullname,
                    cm.id AS activityid,
                    m.name AS moduletype,
                    COALESCE(NULLIF(MAX(t.page_label), ''), '') AS activitylabel,
                    COALESCE(SUM(l.visits), 0) AS visits,
                    COALESCE(SUM(l.time_spent), 0) AS timespent,
                    COUNT(DISTINCT t.userid) AS uniqueusers,
                    COALESCE(MAX(l.last_access), 0) AS lastactivity,
                    COALESCE(MIN(NULLIF(t.first_access, 0)), 0) AS firstaccess,
                    COALESCE(MAX(cm.added), 0) AS createdat,
                    COALESCE(MAX(eventagg.totalevents), 0) AS totalevents,
                    COALESCE(MAX(completionagg.completedusers), 0) AS numcompleted
                FROM {local_mpilot_rpt_log} l
                JOIN {local_mpilot_rpt_track} t ON t.id = l.trackid AND t.page_type = 'module'
                JOIN {course_modules} cm ON cm.id = t.page_instance
                JOIN {modules} m ON m.id = cm.module
                JOIN {course} c ON c.id = cm.course AND c.id <> 1
                LEFT JOIN (
                    SELECT page_instance, COUNT(*) AS totalevents
                    FROM {local_mpilot_rpt_event}
                    WHERE page_type = 'module'
                      AND timecreated BETWEEN ? AND ?
                    GROUP BY page_instance
                ) eventagg ON eventagg.page_instance = cm.id
                LEFT JOIN (
                    SELECT coursemoduleid, COUNT(DISTINCT userid) AS completedusers
                    FROM {course_modules_completion}
                    WHERE completionstate > 0
                    GROUP BY coursemoduleid
                ) completionagg ON completionagg.coursemoduleid = cm.id
                WHERE l.bucket_start BETWEEN ? AND ?
                GROUP BY c.id, c.fullname, cm.id, m.name
                ORDER BY COALESCE(SUM(l.visits), 0) DESC, COALESCE(SUM(l.time_spent), 0) DESC, COALESCE(MAX(l.last_access), 0) DESC
            ", [$startts, $endts, $startts, $endts], 0, 20);

            foreach ($records as $record) {
                $timespent = (int)$record->timespent;
                $modulecode = 'mod_' . trim((string)$record->moduletype);
                $items[] = [
                    'course_id' => (int)$record->courseid,
                    'course_name' => trim((string)$record->coursefullname),
                    'activity_id' => (int)$record->activityid,
                    'module_type' => trim((string)$record->moduletype),
                    'component_name' => self::humanize_component_label($modulecode),
                    'activity_label' => self::activity_label_for_module((string)$record->activitylabel, (string)$record->moduletype, (int)$record->activityid),
                    'visits' => (int)$record->visits,
                    'time_spent_seconds' => $timespent,
                    'time_spent_label' => self::format_duration_label($timespent),
                    'first_access_at' => (int)$record->firstaccess > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->firstaccess) : '',
                    'created_at' => (int)$record->createdat > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->createdat) : '',
                    'num_completed' => (int)$record->numcompleted,
                    'total_events' => max((int)$record->totalevents, (int)$record->visits),
                    'unique_users' => (int)$record->uniqueusers,
                    'last_activity_at' => (int)$record->lastactivity > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->lastactivity) : '',
                ];
            }

            return $items;
        }

        $records = [];
        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_records_sql("
                SELECT
                    COALESCE(c.id, 0) AS courseid,
                    COALESCE(c.fullname, '') AS coursefullname,
                    COALESCE(NULLIF(e.component, ''), 'core') AS component,
                    COALESCE(NULLIF(e.target, ''), 'activity') AS target,
                    COUNT(*) AS totalevents,
                    COUNT(DISTINCT e.userid) AS uniqueusers,
                    MAX(e.timecreated) AS lastactivity
                FROM {local_mpilot_rpt_event} e
                LEFT JOIN {course} c ON c.id = e.courseid
                WHERE e.userid > 0
                  AND e.timecreated BETWEEN ? AND ?
                  AND (e.courseid IS NULL OR e.courseid <> 1)
                GROUP BY c.id, c.fullname, component, target
                ORDER BY COUNT(*) DESC, MAX(e.timecreated) DESC
            ", [$startts, $endts], 0, 20);
        } else if (self::table_exists('logstore_standard_log')) {
            $records = $DB->get_records_sql("
                SELECT
                    COALESCE(c.id, 0) AS courseid,
                    COALESCE(c.fullname, '') AS coursefullname,
                    COALESCE(NULLIF(l.component, ''), 'core') AS component,
                    COALESCE(NULLIF(l.target, ''), 'activity') AS target,
                    COUNT(*) AS totalevents,
                    COUNT(DISTINCT l.userid) AS uniqueusers,
                    MAX(l.timecreated) AS lastactivity
                FROM {logstore_standard_log} l
                LEFT JOIN {course} c ON c.id = l.courseid
                WHERE l.userid > 0
                  AND l.timecreated BETWEEN ? AND ?
                  AND (l.courseid IS NULL OR l.courseid <> 1)
                GROUP BY c.id, c.fullname, component, target
                ORDER BY COUNT(*) DESC, MAX(l.timecreated) DESC
            ", [$startts, $endts], 0, 20);
        } else {
            return [];
        }

        foreach ($records as $record) {
            $items[] = [
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'activity_id' => 0,
                'module_type' => trim((string)$record->component),
                'component_name' => self::humanize_component_label((string)$record->component),
                'activity_label' => self::humanize_component_target((string)$record->component, (string)$record->target),
                'visits' => 0,
                'time_spent_seconds' => 0,
                'time_spent_label' => self::format_duration_label(0),
                'first_access_at' => '',
                'created_at' => '',
                'num_completed' => 0,
                'total_events' => (int)$record->totalevents,
                'unique_users' => (int)$record->uniqueusers,
                'last_activity_at' => gmdate(\DateTimeInterface::ATOM, (int)$record->lastactivity),
            ];
        }

        return $items;
    }

    private static function build_quiz_activity_detail(int $startts, int $endts): array {
        global $DB;

        if (!self::table_exists('quiz_attempts') || !self::table_exists('quiz')) {
            return [];
        }

        $records = $DB->get_records_sql("
            SELECT
                q.id AS quizid,
                q.name AS quizname,
                c.id AS courseid,
                c.fullname AS coursefullname,
                u.id AS userid,
                u.firstname,
                u.lastname,
                COALESCE(u.email, '') AS email,
                COUNT(qa.id) AS attempts,
                SUM(CASE WHEN qa.state = 'finished' THEN 1 ELSE 0 END) AS finishedattempts,
                ROUND(COALESCE(MAX(qa.sumgrades), 0)::numeric, 1) AS bestscore,
                ROUND(COALESCE(AVG(qa.sumgrades), 0)::numeric, 1) AS averagescore,
                ROUND(COALESCE(MIN(qa.sumgrades), 0)::numeric, 1) AS lowestscore,
                MAX(qa.timemodified) AS lastattempt,
                MAX(CASE WHEN qa.timefinish > qa.timestart THEN qa.timefinish ELSE 0 END) AS completionat,
                COALESCE(MAX(trackagg.timespent), 0) AS trackedseconds,
                COALESCE(SUM(CASE WHEN qa.timefinish > qa.timestart THEN qa.timefinish - qa.timestart ELSE 0 END), 0) AS attemptseconds
            FROM {quiz_attempts} qa
            JOIN {quiz} q ON q.id = qa.quiz
            JOIN {course} c ON c.id = q.course AND c.id <> 1
            JOIN {user} u ON u.id = qa.userid
            LEFT JOIN {course_modules} cm ON cm.instance = q.id
            LEFT JOIN {modules} m ON m.id = cm.module AND m.name = 'quiz'
            LEFT JOIN (
                SELECT
                    t.userid,
                    t.page_instance AS cmid,
                    COALESCE(SUM(l.time_spent), 0) AS timespent
                FROM {local_mpilot_rpt_track} t
                JOIN {local_mpilot_rpt_log} l ON l.trackid = t.id
                WHERE t.page_type = 'module'
                  AND l.bucket_start BETWEEN ? AND ?
                GROUP BY t.userid, t.page_instance
            ) trackagg ON trackagg.userid = qa.userid AND trackagg.cmid = cm.id
            WHERE qa.userid > 0
              AND qa.timemodified BETWEEN ? AND ?
            GROUP BY q.id, q.name, c.id, c.fullname, u.id, u.firstname, u.lastname, u.email
            ORDER BY MAX(qa.timemodified) DESC
        ", [$startts, $endts, $startts, $endts], 0, 20);

        $items = [];
        foreach ($records as $record) {
            $timespent = max((int)$record->trackedseconds, (int)$record->attemptseconds);
            $finishedattempts = (int)$record->finishedattempts;
            $attempts = (int)$record->attempts;
            $items[] = [
                'quiz_id' => (int)$record->quizid,
                'quiz_name' => trim((string)$record->quizname),
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'user_id' => (int)$record->userid,
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'email' => trim((string)$record->email),
                'attempts' => $attempts,
                'finished_attempts' => $finishedattempts,
                'best_score' => (float)$record->bestscore,
                'average_score' => (float)$record->averagescore,
                'lowest_score' => (float)$record->lowestscore,
                'time_spent_seconds' => $timespent,
                'time_spent_label' => self::format_duration_label($timespent),
                'status_label' => $finishedattempts > 0 && $finishedattempts >= $attempts ? 'Finished' : ($finishedattempts > 0 ? 'In Progress' : 'Started'),
                'completion_at' => (int)$record->completionat > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->completionat) : '',
                'last_attempt_at' => gmdate(\DateTimeInterface::ATOM, (int)$record->lastattempt),
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

        if (self::table_has_records_select('local_mpilot_rpt_log', 'bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_records_sql("
                SELECT
                    t.userid,
                    COALESCE(SUM(l.session_starts), 0) AS sessions,
                    COALESCE(SUM(l.time_spent), 0) AS totalonlineseconds,
                    MAX(l.last_access) AS lastactivity
                FROM {local_mpilot_rpt_log} l
                JOIN {local_mpilot_rpt_track} t ON t.id = l.trackid
                WHERE t.userid > 0
                  AND l.bucket_start BETWEEN ? AND ?
                GROUP BY t.userid
            ", [$startts, $endts]);

            $totalsessions = 0;
            $totalseconds = 0;
            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $sessions = max(0, (int)$record->sessions);
                $seconds = max(0, (int)$record->totalonlineseconds);
                $lastactivity = (int)$record->lastactivity;

                $result['per_user'][$userid] = [
                    'sessions' => $sessions,
                    'total_online_seconds' => $seconds,
                    'last_activity' => $lastactivity,
                ];
                $totalsessions += $sessions;
                $totalseconds += $seconds;
            }

            if ($totalsessions > 0) {
                $result['average_session_seconds'] = (int)round($totalseconds / $totalsessions);
            }

            return $result;
        }

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

        if (empty($userids)) {
            return [];
        }

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
            [$eventsql, $eventparams] = $DB->get_in_or_equal([
                '\\mod_assign\\event\\assessable_submitted',
                '\\mod_quiz\\event\\attempt_submitted',
            ], SQL_PARAMS_QM);

            $records = $DB->get_records_sql("
                SELECT userid, COUNT(*) AS total
                FROM {local_mpilot_rpt_event}
                WHERE userid $insql
                  AND eventname $eventsql
                  AND timecreated BETWEEN ? AND ?
                GROUP BY userid
            ", array_merge($params, $eventparams, [$startts, $endts]));

            $counts = [];
            foreach ($records as $record) {
                $counts[(int)$record->userid] = (int)$record->total;
            }

            return $counts;
        }

        if (!self::table_exists('assign_submission')) {
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

    private static function table_has_records_select(string $tablename, string $select, array $params = []): bool {
        global $DB;

        if (!self::table_exists($tablename)) {
            return false;
        }

        return $DB->record_exists_select($tablename, $select, $params);
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

    private static function humanize_component_label(string $component): string {
        $component = strtolower(trim($component));
        if ($component === '' || $component === 'core') {
            return 'Core';
        }
        $mapping = [
            'mod_assign' => 'Assignment',
            'mod_quiz' => 'Quiz',
            'mod_forum' => 'Forum',
            'mod_resource' => 'Resource',
            'mod_url' => 'URL',
            'mod_page' => 'Page',
            'mod_lesson' => 'Lesson',
            'core_course' => 'Course',
            'core_user' => 'User',
        ];
        if (isset($mapping[$component])) {
            return $mapping[$component];
        }
        return ucfirst(str_replace(['mod_', 'core_', '_'], ['', '', ' '], $component));
    }

    private static function humanize_component_target(string $component, string $target): string {
        $componentlabel = self::humanize_component_label($component);
        $target = trim(str_replace('_', ' ', $target));
        if ($target === '') {
            return $componentlabel;
        }
        return trim($componentlabel . ' - ' . ucfirst($target));
    }

    private static function activity_label_for_module(string $label, string $moduletype, int $activityid): string {
        $label = trim($label);
        if ($label !== '') {
            return $label;
        }
        $componentlabel = self::humanize_component_label('mod_' . trim($moduletype));
        if ($activityid > 0) {
            return $componentlabel . ' #' . $activityid;
        }
        return $componentlabel;
    }

    private static function humanize_enrolment_method(string $value): string {
        $value = strtolower(trim($value));
        $mapping = [
            'manual' => 'Manual',
            'self' => 'Self enrolment',
            'guest' => 'Guest',
            'cohort' => 'Cohort sync',
            'meta' => 'Course meta',
            'paypal' => 'PayPal',
            'database' => 'External database',
        ];
        if (isset($mapping[$value])) {
            return $mapping[$value];
        }
        if ($value === '') {
            return 'Unknown';
        }
        return ucfirst(str_replace('_', ' ', $value));
    }

    private static function humanize_status_key(string $value): string {
        $value = strtolower(trim($value));
        if ($value === 'completed') {
            return 'Completed';
        }
        if ($value === 'in_progress') {
            return 'In Progress';
        }
        return 'Not Started';
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
