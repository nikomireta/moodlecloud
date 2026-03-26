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
        'today',
        'last_7_days',
        'last_30_days',
        'this_month',
        'last_month',
    ];

    private static array $cache = [];

    public static function supported_period_keys(): array {
        return self::SUPPORTED_PERIOD_KEYS;
    }

    public static function dashboard_section_keys(): array {
        return [
            'summary_metrics',
            'daily_trend',
            'course_completion_summary',
            'assignment_submission_detail',
            'forum_engagement_summary',
            'grade_recap_per_course',
            'gradebook_detail',
            'user_activity_summary',
            'user_status',
            'at_risk_users',
            'activity_stats_summary',
            'activity_completion_detail',
            'quiz_activity_detail',
            'quiz_question_analysis',
            'recent_activity',
        ];
    }

    public static function course_options(): array {
        $cachekey = 'course_options';
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $options = [0 => get_string('dashboard:filter_all_courses', 'local_moodlepilot_report')];
        if (!self::table_exists('course')) {
            self::$cache[$cachekey] = $options;
            return $options;
        }

        $records = $DB->get_records_sql("\n            SELECT id, fullname\n            FROM {course}\n            WHERE id <> 1\n            ORDER BY fullname ASC\n        ");
        foreach ($records as $record) {
            $options[(int)$record->id] = trim((string)$record->fullname);
        }

        self::$cache[$cachekey] = $options;
        return $options;
    }

    public static function normalize_filters($periodkey = 'last_7_days', int $courseid = 0): array {
        if (is_array($periodkey)) {
            $courseid = (int)($periodkey['course_id'] ?? 0);
            $periodkey = (string)($periodkey['period_key'] ?? 'last_7_days');
        }

        [$periodstart, $periodend, $normalizedperiodkey] = self::resolve_period_range((string)$periodkey);
        $courseoptions = self::course_options();
        if ($courseid > 0 && !array_key_exists($courseid, $courseoptions)) {
            $courseid = 0;
        }

        return [
            'period_key' => $normalizedperiodkey,
            'course_id' => $courseid,
            'period_start' => $periodstart->format(\DateTimeInterface::ATOM),
            'period_end' => $periodend->format(\DateTimeInterface::ATOM),
            'start_ts' => $periodstart->getTimestamp(),
            'end_ts' => $periodend->getTimestamp(),
        ];
    }

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
        $filters = self::normalize_filters($periodkey, 0);
        $summarymetrics = self::collect_summary_metrics($filters);

        return [
            'snapshot_key' => 'reports_summary_v1',
            'period_key' => $filters['period_key'],
            'period_start' => $filters['period_start'],
            'period_end' => $filters['period_end'],
            'payload' => [
                'summary_metrics' => $summarymetrics,
                'daily_trend' => self::build_table_section('daily_trend', $filters)['rows'],
                'recent_activity' => self::build_table_section('recent_activity', $filters)['rows'],
                'course_completion_summary' => self::build_table_section('course_completion_summary', $filters)['rows'],
                'assignment_submission_detail' => self::build_table_section('assignment_submission_detail', $filters)['rows'],
                'forum_engagement_summary' => self::build_table_section('forum_engagement_summary', $filters)['rows'],
                'grade_recap_per_course' => self::build_table_section('grade_recap_per_course', $filters)['rows'],
                'gradebook_detail' => self::build_table_section('gradebook_detail', $filters)['rows'],
                'user_activity_summary' => self::build_table_section('user_activity_summary', $filters)['rows'],
                'user_status' => self::build_table_section('user_status', $filters)['rows'],
                'at_risk_users' => self::build_table_section('at_risk_users', $filters)['rows'],
                'activity_stats_summary' => self::build_table_section('activity_stats_summary', $filters)['rows'],
                'activity_completion_detail' => self::build_table_section('activity_completion_detail', $filters)['rows'],
                'quiz_activity_detail' => self::build_table_section('quiz_activity_detail', $filters)['rows'],
                'quiz_question_analysis' => self::build_table_section('quiz_question_analysis', $filters)['rows'],
            ],
        ];
    }

    public static function build_table_section(string $section, array $filters, int $limit = 0, int $offset = 0): array {
        $filters = self::normalize_filters($filters);
        $section = strtolower(trim($section));

        switch ($section) {
            case 'summary_metrics':
                $summarymetrics = self::collect_summary_metrics($filters);
                $items = [
                    ['metric' => 'Logins', 'value' => (int)$summarymetrics['login_count']],
                    ['metric' => 'Active users', 'value' => (int)$summarymetrics['active_users']],
                    ['metric' => 'Submissions', 'value' => (int)$summarymetrics['submissions']],
                    ['metric' => 'Completions', 'value' => (int)$summarymetrics['completions']],
                    ['metric' => 'Sessions', 'value' => (int)$summarymetrics['session_count']],
                    ['metric' => 'Average session', 'value' => (string)$summarymetrics['avg_online_label']],
                ];
                break;
            case 'daily_trend':
                $items = self::collect_daily_trend($filters);
                break;
            case 'course_completion_summary':
                $items = self::collect_course_completion_summary($filters);
                break;
            case 'assignment_submission_detail':
                $items = self::collect_assignment_submission_detail($filters);
                break;
            case 'forum_engagement_summary':
                $items = self::collect_forum_engagement_summary($filters);
                break;
            case 'grade_recap_per_course':
                $items = self::collect_grade_recap_per_course($filters);
                break;
            case 'gradebook_detail':
                $items = self::collect_gradebook_detail($filters);
                break;
            case 'user_activity_summary':
                $items = self::collect_user_activity_summary($filters);
                break;
            case 'user_status':
                $items = self::collect_user_status($filters);
                break;
            case 'at_risk_users':
                $items = self::collect_at_risk_users($filters);
                break;
            case 'activity_stats_summary':
                $items = self::collect_activity_stats_summary($filters);
                break;
            case 'activity_completion_detail':
                $items = self::collect_activity_completion_detail($filters);
                break;
            case 'quiz_activity_detail':
                $items = self::collect_quiz_activity_detail($filters);
                break;
            case 'quiz_question_analysis':
                $items = self::collect_quiz_question_analysis($filters);
                break;
            case 'recent_activity':
                $items = self::collect_recent_activity($filters);
                break;
            default:
                $items = [];
                break;
        }

        return self::paginate_items($items, $limit, $offset);
    }

    private static function resolve_period_range(string $periodkey): array {
        $periodend = new \DateTimeImmutable('now', self::report_timezone());
        $todaystart = $periodend->setTime(0, 0, 0);
        $normalizedperiodkey = strtolower(trim($periodkey));

        switch ($normalizedperiodkey) {
            case 'today':
                $periodstart = $todaystart;
                break;
            case 'last_30_days':
                $periodstart = $todaystart->sub(new \DateInterval('P29D'));
                break;
            case 'this_month':
                $periodstart = $periodend->modify('first day of this month')->setTime(0, 0, 0);
                break;
            case 'last_month':
                $periodstart = $periodend->modify('first day of last month')->setTime(0, 0, 0);
                $periodend = $periodend->modify('last day of last month')->setTime(23, 59, 59);
                break;
            case 'last_7_days':
            default:
                $normalizedperiodkey = 'last_7_days';
                $periodstart = $todaystart->sub(new \DateInterval('P6D'));
                break;
        }

        return [$periodstart, $periodend, $normalizedperiodkey];
    }

    private static function report_timezone(): \DateTimeZone {
        if (class_exists('\core_date') && method_exists('\core_date', 'get_server_timezone_object')) {
            return \core_date::get_server_timezone_object();
        }

        return new \DateTimeZone('UTC');
    }

    private static function collect_summary_metrics(array $filters): array {
        $cachekey = self::cache_key('summary_metrics', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $sessionstats = self::build_session_stats($filters);
        $activeuserids = self::collect_active_user_ids($filters, $sessionstats);
        $summary = [
            'login_count' => 0,
            'active_users' => count($activeuserids),
            'submissions' => 0,
            'completions' => 0,
            'session_count' => (int)($sessionstats['total_sessions'] ?? 0),
            'avg_online_seconds' => (int)($sessionstats['average_session_seconds'] ?? 0),
            'avg_online_label' => self::format_duration_label((int)($sessionstats['average_session_seconds'] ?? 0)),
        ];

        $summary['submissions'] = self::count_submissions($filters);
        $summary['completions'] = self::count_completions($filters);

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts, '\\core\\event\\user_loggedin'];
            $select = 'userid > 0 AND timecreated BETWEEN ? AND ? AND eventname = ?';
            if ($courseid > 0) {
                if (empty($activeuserids)) {
                    self::$cache[$cachekey] = $summary;
                    return $summary;
                }
                [$insql, $inparams] = $DB->get_in_or_equal($activeuserids, SQL_PARAMS_QM);
                $select .= " AND userid $insql";
                $params = array_merge($params, $inparams);
            }
            $summary['login_count'] = (int)$DB->count_records_select('local_mpilot_rpt_event', $select, $params);
            self::$cache[$cachekey] = $summary;
            return $summary;
        }

        if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts, 'user', 'loggedin'];
            $select = 'userid > 0 AND timecreated BETWEEN ? AND ? AND target = ? AND action = ?';
            if ($courseid > 0) {
                if (empty($activeuserids)) {
                    self::$cache[$cachekey] = $summary;
                    return $summary;
                }
                [$insql, $inparams] = $DB->get_in_or_equal($activeuserids, SQL_PARAMS_QM);
                $select .= " AND userid $insql";
                $params = array_merge($params, $inparams);
            }
            $summary['login_count'] = (int)$DB->count_records_select('logstore_standard_log', $select, $params);
        }

        self::$cache[$cachekey] = $summary;
        return $summary;
    }

    private static function collect_daily_trend(array $filters): array {
        $cachekey = self::cache_key('daily_trend', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        $days = self::build_day_series($filters);
        $activitybyday = self::collect_activity_users_and_seconds_by_day($filters);
        $loginsbyday = self::collect_login_counts_by_day($filters, $activitybyday);
        $submissionsbyday = self::collect_submissions_by_day($filters);
        $completionsbyday = self::collect_completions_by_day($filters);

        $items = [];
        foreach ($days as $daybucket => $label) {
            $activeusers = isset($activitybyday[$daybucket]['users']) ? count($activitybyday[$daybucket]['users']) : 0;
            $sessionseconds = (int)($activitybyday[$daybucket]['session_time_seconds'] ?? 0);
            $items[] = [
                'day_bucket' => (int)$daybucket,
                'day_label' => $label,
                'login_count' => (int)($loginsbyday[$daybucket] ?? 0),
                'active_users' => $activeusers,
                'submission_count' => (int)($submissionsbyday[$daybucket] ?? 0),
                'completion_count' => (int)($completionsbyday[$daybucket] ?? 0),
                'session_time_seconds' => $sessionseconds,
                'session_time_label' => self::format_duration_label($sessionseconds),
            ];
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_recent_activity(array $filters): array {
        $cachekey = self::cache_key('recent_activity', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $records = [];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND e.courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    e.id,\n                    e.userid,\n                    e.action,\n                    e.target,\n                    e.component,\n                    e.timecreated,\n                    COALESCE(e.userip, '') AS ip,\n                    COALESCE(u.firstname, '') AS firstname,\n                    COALESCE(u.lastname, '') AS lastname,\n                    COALESCE(c.fullname, '') AS coursefullname\n                FROM {local_mpilot_rpt_event} e\n                JOIN {user} u ON u.id = e.userid\n                LEFT JOIN {course} c ON c.id = e.courseid\n                WHERE e.userid > 0\n                  AND e.timecreated BETWEEN ? AND ?\n                  $coursesql\n                ORDER BY e.timecreated DESC\n            ", $params);
        } else if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND l.courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    l.id,\n                    l.userid,\n                    l.action,\n                    l.target,\n                    l.component,\n                    l.timecreated,\n                    COALESCE(l.ip, '') AS ip,\n                    COALESCE(u.firstname, '') AS firstname,\n                    COALESCE(u.lastname, '') AS lastname,\n                    COALESCE(c.fullname, '') AS coursefullname\n                FROM {logstore_standard_log} l\n                JOIN {user} u ON u.id = l.userid\n                LEFT JOIN {course} c ON c.id = l.courseid\n                WHERE l.userid > 0\n                  AND l.timecreated BETWEEN ? AND ?\n                  $coursesql\n                ORDER BY l.timecreated DESC\n            ", $params);
        }

        $items = [];
        foreach ($records as $record) {
            $items[] = [
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'action' => self::humanize_log_action((string)$record->action, (string)$record->target, (string)$record->component, (string)$record->coursefullname),
                'occurred_at' => gmdate(\DateTimeInterface::ATOM, (int)$record->timecreated),
            ];
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_course_completion_summary(array $filters): array {
        $cachekey = self::cache_key('course_completion_summary', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('course_completions')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $params = [$startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $activitymap = self::build_course_last_activity_map($filters);
        $records = $DB->get_recordset_sql("\n            SELECT\n                c.id,\n                c.fullname,\n                ue.userid,\n                COALESCE(cc.timecompleted, 0) AS timecompleted,\n                COALESCE(cc.timestarted, 0) AS timestarted\n            FROM {course} c\n            JOIN {enrol} e ON e.courseid = c.id AND e.status = 0\n            JOIN {user_enrolments} ue ON ue.enrolid = e.id AND ue.status = 0\n            JOIN {user} u ON u.id = ue.userid AND u.deleted = 0 AND u.suspended = 0\n            LEFT JOIN {course_completions} cc ON cc.course = c.id AND cc.userid = ue.userid\n            WHERE c.id <> 1\n              $coursesql\n            ORDER BY c.fullname ASC, ue.userid ASC\n        ", $params);

        $summarybycourse = [];
        foreach ($records as $record) {
            $coursekey = (int)$record->id;
            if (!isset($summarybycourse[$coursekey])) {
                $summarybycourse[$coursekey] = [
                    'course_id' => $coursekey,
                    'course_name' => trim((string)$record->fullname),
                    'enrolled' => 0,
                    'completed' => 0,
                    'in_progress' => 0,
                    'not_started' => 0,
                    'completion_rate' => 0,
                ];
            }

            $summarybycourse[$coursekey]['enrolled']++;
            $userid = (int)$record->userid;
            $timecompleted = (int)$record->timecompleted;
            $timestarted = (int)$record->timestarted;
            $hasactivity = !empty($activitymap[$userid][$coursekey]);

            if ($timecompleted > 0) {
                $summarybycourse[$coursekey]['completed']++;
            } else if ($timestarted > 0 || $hasactivity) {
                $summarybycourse[$coursekey]['in_progress']++;
            } else {
                $summarybycourse[$coursekey]['not_started']++;
            }
        }
        $records->close();

        $items = array_values($summarybycourse);
        foreach ($items as &$item) {
            $item['completion_rate'] = (int)$item['enrolled'] > 0
                ? (int)round(((int)$item['completed'] / (int)$item['enrolled']) * 100)
                : 0;
        }
        unset($item);

        usort($items, static function(array $left, array $right): int {
            $enrolcompare = (int)$right['enrolled'] <=> (int)$left['enrolled'];
            if ($enrolcompare !== 0) {
                return $enrolcompare;
            }
            return strcmp((string)$left['course_name'], (string)$right['course_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_assignment_submission_detail(array $filters): array {
        $cachekey = self::cache_key('assignment_submission_detail', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('assign') || !self::table_exists('enrol') || !self::table_exists('user_enrolments')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $assignments = [];
        $items = [];

        $assignmentparams = [];
        $assignmentcoursesql = '';
        if ($courseid > 0) {
            $assignmentcoursesql = ' AND c.id = ?';
            $assignmentparams[] = $courseid;
        }

        $cmjoin = '';
        $cmfields = '0 AS activityid';
        if (self::table_exists('modules') && self::table_exists('course_modules')) {
            $cmjoin = "LEFT JOIN {modules} m ON m.name = 'assign'
                LEFT JOIN {course_modules} cm ON cm.instance = a.id AND cm.module = m.id";
            $cmfields = 'COALESCE(MAX(cm.id), 0) AS activityid';
        }

        $records = $DB->get_records_sql("
            SELECT
                a.id AS assignmentid,
                c.id AS courseid,
                c.fullname AS coursefullname,
                a.name AS assignmentname,
                a.duedate,
                a.timemodified AS assignmentmodified,
                $cmfields
            FROM {assign} a
            JOIN {course} c ON c.id = a.course AND c.id <> 1
            $cmjoin
            WHERE 1 = 1
              $assignmentcoursesql
            GROUP BY a.id, c.id, c.fullname, a.name, a.duedate, a.timemodified
            ORDER BY c.fullname ASC, a.duedate ASC, a.name ASC
        ", $assignmentparams);

        foreach ($records as $record) {
            $assignmentid = (int)$record->assignmentid;
            $assignments[$assignmentid] = [
                'assignment_id' => $assignmentid,
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'assignment_name' => trim((string)$record->assignmentname),
                'due_ts' => (int)$record->duedate,
                'activity_id' => (int)$record->activityid,
            ];
        }

        if (empty($assignments)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $enrolledusers = self::collect_enrolled_users_by_course($filters);
        if (empty($enrolledusers)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $submissionmap = [];
        if (self::table_exists('assign_submission')) {
            $submissionparams = [];
            $submissionjoinsql = '';
            $submissioncoursesql = '';
            if ($courseid > 0) {
                $submissionjoinsql = ' JOIN {assign} a ON a.id = s.assignment';
                $submissioncoursesql = ' AND a.course = ?';
                $submissionparams[] = $courseid;
            }

            $submissions = $DB->get_recordset_sql("
                SELECT
                    s.assignment,
                    s.userid,
                    COALESCE(s.status, '') AS status,
                    GREATEST(COALESCE(s.timecreated, 0), COALESCE(s.timemodified, 0)) AS submittedat
                FROM {assign_submission} s
                $submissionjoinsql
                WHERE s.userid > 0
                  AND s.latest = 1
                  AND s.groupid = 0
                  $submissioncoursesql
            ", $submissionparams);

            foreach ($submissions as $submission) {
                $submissionmap[(int)$submission->assignment . ':' . (int)$submission->userid] = [
                    'status' => trim((string)$submission->status),
                    'submitted_at' => (int)$submission->submittedat,
                ];
            }
            $submissions->close();
        }

        $grademap = [];
        if (self::table_exists('assign_grades')) {
            $gradeparams = [];
            $gradejoinsql = '';
            $gradecoursesql = '';
            if ($courseid > 0) {
                $gradejoinsql = ' JOIN {assign} a ON a.id = g.assignment';
                $gradecoursesql = ' AND a.course = ?';
                $gradeparams[] = $courseid;
            }

            $grades = $DB->get_recordset_sql("
                SELECT
                    g.assignment,
                    g.userid,
                    g.grade,
                    g.timemodified
                FROM {assign_grades} g
                $gradejoinsql
                WHERE g.userid > 0
                  $gradecoursesql
                ORDER BY g.assignment ASC, g.userid ASC, g.timemodified DESC, g.id DESC
            ", $gradeparams);

            foreach ($grades as $grade) {
                $mapkey = (int)$grade->assignment . ':' . (int)$grade->userid;
                if (!isset($grademap[$mapkey])) {
                    $grademap[$mapkey] = [
                        'grade' => $grade->grade === null ? null : round((float)$grade->grade, 1),
                        'graded_at' => (int)$grade->timemodified,
                    ];
                }
            }
            $grades->close();
        }

        $gradeitemmap = [];
        if (self::table_exists('grade_items')) {
            $gradeitemparams = [];
            $gradeitemcoursesql = '';
            if ($courseid > 0) {
                $gradeitemcoursesql = ' AND gi.courseid = ?';
                $gradeitemparams[] = $courseid;
            }

            $gradeitems = $DB->get_records_sql("
                SELECT gi.id, gi.iteminstance
                FROM {grade_items} gi
                WHERE gi.itemtype = 'mod'
                  AND gi.itemmodule = 'assign'
                  AND gi.iteminstance > 0
                  $gradeitemcoursesql
                ORDER BY gi.id ASC
            ", $gradeitemparams);

            foreach ($gradeitems as $gradeitem) {
                $gradeitemmap[(int)$gradeitem->iteminstance] = (int)$gradeitem->id;
            }
        }

        foreach ($assignments as $assignment) {
            $courseusers = $enrolledusers[(int)$assignment['course_id']] ?? [];
            if (empty($courseusers)) {
                continue;
            }

            foreach ($courseusers as $user) {
                $mapkey = (int)$assignment['assignment_id'] . ':' . (int)$user['user_id'];
                $submission = $submissionmap[$mapkey] ?? ['status' => '', 'submitted_at' => 0];
                $grade = $grademap[$mapkey] ?? ['grade' => null, 'graded_at' => 0];
                $submissionstatus = trim((string)$submission['status']);
                $submittedat = $submissionstatus === 'submitted' ? (int)$submission['submitted_at'] : 0;
                $dueat = (int)$assignment['due_ts'];
                $gradedat = (int)$grade['graded_at'];
                $hasgrade = $grade['grade'] !== null;
                $islate = $submittedat > 0 && $dueat > 0 && $submittedat > $dueat;

                if ($hasgrade) {
                    $statuskey = 'graded';
                } else if ($islate) {
                    $statuskey = 'late';
                } else if ($submittedat > 0) {
                    $statuskey = 'submitted';
                } else if ($dueat > 0 && $dueat <= $endts) {
                    $statuskey = 'missing';
                } else {
                    $statuskey = 'pending';
                }

                $relevant = ($submittedat >= $startts && $submittedat <= $endts)
                    || ($gradedat >= $startts && $gradedat <= $endts)
                    || ($dueat > 0 && $dueat >= $startts && $dueat <= $endts)
                    || (($statuskey === 'missing' || $statuskey === 'late') && $dueat > 0 && $dueat <= $endts);
                if (!$relevant) {
                    continue;
                }

                $latebyseconds = $islate ? max(0, $submittedat - $dueat) : 0;
                $items[] = [
                    'assignment_id' => (int)$assignment['assignment_id'],
                    'activity_id' => (int)$assignment['activity_id'],
                    'grade_item_id' => (int)($gradeitemmap[(int)$assignment['assignment_id']] ?? 0),
                    'course_id' => (int)$assignment['course_id'],
                    'course_name' => (string)$assignment['course_name'],
                    'assignment_name' => (string)$assignment['assignment_name'],
                    'user_id' => (int)$user['user_id'],
                    'user_name' => (string)$user['user_name'],
                    'due_at' => $dueat > 0 ? gmdate(\DateTimeInterface::ATOM, $dueat) : '',
                    'submitted_at' => $submittedat > 0 ? gmdate(\DateTimeInterface::ATOM, $submittedat) : '',
                    'status_key' => $statuskey,
                    'status_label' => self::humanize_assignment_status_key($statuskey),
                    'grade' => $grade['grade'],
                    'graded_at' => $gradedat > 0 ? gmdate(\DateTimeInterface::ATOM, $gradedat) : '',
                    'missing_grade' => !$hasgrade,
                    'late_by_seconds' => $latebyseconds,
                    'late_by_label' => self::format_duration_label($latebyseconds),
                ];
            }
        }

        $statusorder = [
            'missing' => 0,
            'late' => 1,
            'pending' => 2,
            'submitted' => 3,
            'graded' => 4,
        ];

        usort($items, static function(array $left, array $right) use ($statusorder): int {
            $leftorder = $statusorder[(string)$left['status_key']] ?? 99;
            $rightorder = $statusorder[(string)$right['status_key']] ?? 99;
            if ($leftorder !== $rightorder) {
                return $leftorder <=> $rightorder;
            }

            $leftdue = trim((string)$left['due_at']);
            $rightdue = trim((string)$right['due_at']);
            if ($leftdue === '' && $rightdue !== '') {
                return 1;
            }
            if ($leftdue !== '' && $rightdue === '') {
                return -1;
            }
            if ($leftdue !== $rightdue) {
                return strcmp($leftdue, $rightdue);
            }

            $assignmentcompare = strcmp((string)$left['assignment_name'], (string)$right['assignment_name']);
            if ($assignmentcompare !== 0) {
                return $assignmentcompare;
            }

            return strcmp((string)$left['user_name'], (string)$right['user_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_forum_engagement_summary(array $filters): array {
        $cachekey = self::cache_key('forum_engagement_summary', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('forum') || !self::table_exists('forum_discussions') || !self::table_exists('forum_posts')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $params = [$startts, $endts, $startts, $endts, $startts, $endts, $startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }
        $cmjoin = '';
        $cmfields = '0 AS activityid';
        if (self::table_exists('modules') && self::table_exists('course_modules')) {
            $cmjoin = "LEFT JOIN {modules} m ON m.name = 'forum'
                LEFT JOIN {course_modules} cm ON cm.instance = f.id AND cm.module = m.id";
            $cmfields = 'COALESCE(MAX(cm.id), 0) AS activityid';
        }

        $records = $DB->get_records_sql("
            SELECT
                f.id AS forumid,
                c.id AS courseid,
                c.fullname AS coursefullname,
                f.name AS forumname,
                $cmfields,
                COUNT(DISTINCT CASE
                    WHEN fp.deleted = 0 AND fp.parent = 0 AND fp.created BETWEEN ? AND ?
                    THEN fp.id
                    ELSE NULL
                END) AS discussioncount,
                COUNT(CASE
                    WHEN fp.deleted = 0 AND fp.created BETWEEN ? AND ?
                    THEN fp.id
                    ELSE NULL
                END) AS postcount,
                COUNT(DISTINCT CASE
                    WHEN fp.deleted = 0 AND fp.created BETWEEN ? AND ?
                    THEN fp.userid
                    ELSE NULL
                END) AS activeparticipants,
                MAX(CASE
                    WHEN fp.deleted = 0 AND fp.created BETWEEN ? AND ?
                    THEN fp.created
                    ELSE 0
                END) AS latestpost
            FROM {forum} f
            JOIN {course} c ON c.id = f.course AND c.id <> 1
            $cmjoin
            LEFT JOIN {forum_discussions} fd ON fd.forum = f.id
            LEFT JOIN {forum_posts} fp ON fp.discussion = fd.id
            WHERE 1 = 1
              $coursesql
            GROUP BY f.id, c.id, c.fullname, f.name
            HAVING COUNT(CASE
                WHEN fp.deleted = 0 AND fp.created BETWEEN ? AND ?
                THEN fp.id
                ELSE NULL
            END) > 0
            ORDER BY postcount DESC, activeparticipants DESC, latestpost DESC
        ", array_merge($params, [$startts, $endts]));

        $items = [];
        foreach ($records as $record) {
            $latestpost = (int)$record->latestpost;
            $items[] = [
                'forum_id' => (int)$record->forumid,
                'activity_id' => (int)$record->activityid,
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'forum_name' => trim((string)$record->forumname),
                'discussion_count' => (int)$record->discussioncount,
                'post_count' => (int)$record->postcount,
                'active_participants' => (int)$record->activeparticipants,
                'latest_post_at' => $latestpost > 0 ? gmdate(\DateTimeInterface::ATOM, $latestpost) : '',
            ];
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_grade_recap_per_course(array $filters): array {
        $cachekey = self::cache_key('grade_recap_per_course', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('grade_items') || !self::table_exists('grade_grades')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $params = [$startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $records = $DB->get_records_sql("\n            SELECT\n                c.id,\n                c.fullname,\n                COUNT(CASE WHEN gg.finalgrade IS NOT NULL THEN 1 END) AS gradedcount,\n                COUNT(CASE WHEN gg.finalgrade IS NULL THEN 1 END) AS missinggradecount,\n                ROUND(COALESCE(AVG(gg.finalgrade), 0), 1) AS averagegrade,\n                ROUND(COALESCE(MAX(gg.finalgrade), 0), 1) AS highestgrade,\n                ROUND(COALESCE(MIN(gg.finalgrade), 0), 1) AS lowestgrade,\n                SUM(CASE\n                    WHEN gg.finalgrade IS NOT NULL AND gg.finalgrade >= CASE WHEN gi.gradepass > 0 THEN gi.gradepass ELSE 60 END\n                    THEN 1 ELSE 0\n                END) AS passedcount,\n                SUM(CASE\n                    WHEN gg.finalgrade IS NOT NULL AND gg.finalgrade < CASE WHEN gi.gradepass > 0 THEN gi.gradepass ELSE 60 END\n                    THEN 1 ELSE 0\n                END) AS failedcount\n            FROM {grade_items} gi\n            JOIN {course} c ON c.id = gi.courseid\n            LEFT JOIN {grade_grades} gg\n              ON gg.itemid = gi.id\n             AND gg.timemodified BETWEEN ? AND ?\n            WHERE gi.itemtype = 'course'\n              AND c.id <> 1\n              $coursesql\n            GROUP BY c.id, c.fullname, gi.gradepass\n            ORDER BY c.fullname ASC\n        ", $params);

        $items = [];
        foreach ($records as $record) {
            $gradedcount = (int)$record->gradedcount;
            $items[] = [
                'course_id' => (int)$record->id,
                'course_name' => trim((string)$record->fullname),
                'average_grade' => $gradedcount > 0 ? (float)$record->averagegrade : null,
                'highest_grade' => $gradedcount > 0 ? (float)$record->highestgrade : null,
                'lowest_grade' => $gradedcount > 0 ? (float)$record->lowestgrade : null,
                'graded_count' => $gradedcount,
                'missing_grade_count' => (int)$record->missinggradecount,
                'passed' => (int)$record->passedcount,
                'failed' => (int)$record->failedcount,
            ];
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_gradebook_detail(array $filters): array {
        $cachekey = self::cache_key('gradebook_detail', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('grade_items') || !self::table_exists('enrol') || !self::table_exists('user_enrolments')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $courseid = (int)$filters['course_id'];
        $enrolledusers = self::collect_enrolled_users_by_course($filters);
        if (empty($enrolledusers)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $itemparams = [];
        $itemcoursesql = '';
        if ($courseid > 0) {
            $itemcoursesql = ' AND c.id = ?';
            $itemparams[] = $courseid;
        }

        $records = $DB->get_records_sql("
            SELECT
                gi.id AS gradeitemid,
                c.id AS courseid,
                c.fullname AS coursefullname,
                COALESCE(gi.itemname, '') AS itemname,
                COALESCE(gi.itemmodule, '') AS itemmodule,
                COALESCE(gi.iteminstance, 0) AS iteminstance,
                COALESCE(gi.gradepass, 0) AS gradepass,
                COALESCE(gi.timemodified, gi.timecreated, 0) AS itemmodified
            FROM {grade_items} gi
            JOIN {course} c ON c.id = gi.courseid AND c.id <> 1
            WHERE gi.itemtype <> 'course'
              AND gi.itemtype <> 'category'
              $itemcoursesql
            ORDER BY c.fullname ASC, gi.sortorder ASC, gi.id ASC
        ", $itemparams);

        if (empty($records)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $grademap = [];
        if (self::table_exists('grade_grades')) {
            $gradeparams = [];
            $gradecoursesql = '';
            if ($courseid > 0) {
                $gradecoursesql = ' AND gi.courseid = ?';
                $gradeparams[] = $courseid;
            }

            $grades = $DB->get_recordset_sql("
                SELECT
                    gg.itemid,
                    gg.userid,
                    gg.finalgrade,
                    gg.timemodified
                FROM {grade_grades} gg
                JOIN {grade_items} gi ON gi.id = gg.itemid
                WHERE gi.itemtype <> 'course'
                  AND gi.itemtype <> 'category'
                  $gradecoursesql
            ", $gradeparams);

            foreach ($grades as $grade) {
                $grademap[(int)$grade->itemid . ':' . (int)$grade->userid] = [
                    'final_grade' => $grade->finalgrade === null ? null : round((float)$grade->finalgrade, 1),
                    'graded_at' => (int)$grade->timemodified,
                ];
            }
            $grades->close();
        }

        $items = [];
        foreach ($records as $record) {
            $courseusers = $enrolledusers[(int)$record->courseid] ?? [];
            if (empty($courseusers)) {
                continue;
            }

            $gradeitemid = (int)$record->gradeitemid;
            $gradeitemname = trim((string)$record->itemname);
            if ($gradeitemname === '') {
                $gradeitemname = self::grade_item_label((string)$record->itemmodule, (int)$record->iteminstance, $gradeitemid);
            }
            $passmark = (float)$record->gradepass > 0 ? (float)$record->gradepass : 60.0;

            foreach ($courseusers as $user) {
                $grade = $grademap[$gradeitemid . ':' . (int)$user['user_id']] ?? ['final_grade' => null, 'graded_at' => 0];
                $finalgrade = $grade['final_grade'];
                $missinggrade = $finalgrade === null;
                $passfail = $missinggrade
                    ? 'Belum dinilai'
                    : ((float)$finalgrade >= $passmark ? 'Lulus' : 'Belum lulus');

                $items[] = [
                    'course_id' => (int)$record->courseid,
                    'course_name' => trim((string)$record->coursefullname),
                    'user_id' => (int)$user['user_id'],
                    'user_name' => (string)$user['user_name'],
                    'grade_item_id' => $gradeitemid,
                    'grade_item_name' => $gradeitemname,
                    'item_module' => trim((string)$record->itemmodule),
                    'item_instance' => (int)$record->iteminstance,
                    'final_grade' => $finalgrade,
                    'pass_fail' => $passfail,
                    'graded_at' => (int)$grade['graded_at'] > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$grade['graded_at']) : '',
                    'missing_grade' => $missinggrade,
                ];
            }
        }

        usort($items, static function(array $left, array $right): int {
            if (!empty($left['missing_grade']) !== !empty($right['missing_grade'])) {
                return !empty($left['missing_grade']) ? -1 : 1;
            }

            $leftgraded = trim((string)$left['graded_at']);
            $rightgraded = trim((string)$right['graded_at']);
            if ($leftgraded !== $rightgraded) {
                return strcmp($rightgraded, $leftgraded);
            }

            $coursecompare = strcmp((string)$left['course_name'], (string)$right['course_name']);
            if ($coursecompare !== 0) {
                return $coursecompare;
            }

            $itemcompare = strcmp((string)$left['grade_item_name'], (string)$right['grade_item_name']);
            if ($itemcompare !== 0) {
                return $itemcompare;
            }

            return strcmp((string)$left['user_name'], (string)$right['user_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_user_activity_summary(array $filters): array {
        $cachekey = self::cache_key('user_activity_summary', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $sessionstats = self::build_session_stats($filters);
        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $records = [];

        if (self::table_has_records_select('local_mpilot_rpt_track', 'userid > 0 AND last_access BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND (t.courseid = ? OR (t.page_type = ? AND t.page_instance = ?))';
                $params[] = $courseid;
                $params[] = 'course';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    u.id,\n                    u.firstname,\n                    u.lastname,\n                    MAX(t.last_access) AS lastaction\n                FROM {user} u\n                JOIN {local_mpilot_rpt_track} t ON t.userid = u.id AND t.last_access BETWEEN ? AND ?\n                WHERE u.deleted = 0\n                  AND u.suspended = 0\n                  AND u.id > 0\n                  $coursesql\n                GROUP BY u.id, u.firstname, u.lastname\n                ORDER BY MAX(t.last_access) DESC\n            ", $params);
        } else if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND l.courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    u.id,\n                    u.firstname,\n                    u.lastname,\n                    MAX(l.timecreated) AS lastaction\n                FROM {user} u\n                JOIN {logstore_standard_log} l ON l.userid = u.id AND l.timecreated BETWEEN ? AND ?\n                WHERE u.deleted = 0\n                  AND u.suspended = 0\n                  AND u.id > 0\n                  $coursesql\n                GROUP BY u.id, u.firstname, u.lastname\n                ORDER BY MAX(l.timecreated) DESC\n            ", $params);
        } else {
            self::$cache[$cachekey] = [];
            return [];
        }

        $userids = array_map(static function($record) {
            return (int)$record->id;
        }, array_values($records));

        $rolemap = self::build_user_role_map($userids);
        $submissionmap = self::build_user_submission_map($userids, $filters);
        $items = [];
        foreach ($records as $record) {
            $userid = (int)$record->id;
            $stats = $sessionstats['per_user'][$userid] ?? ['sessions' => 0, 'total_online_seconds' => 0];
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

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_user_status(array $filters): array {
        $cachekey = self::cache_key('user_status', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('user_enrolments') || !self::table_exists('enrol')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $courseid = (int)$filters['course_id'];
        $params = [];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $activitymap = self::build_course_last_activity_map($filters);
        $records = $DB->get_records_sql("\n            SELECT\n                u.id AS userid,\n                u.firstname,\n                u.lastname,\n                c.id AS courseid,\n                c.fullname AS coursefullname,\n                COALESCE(c.shortname, '') AS courseshortname,\n                COALESCE(e.enrol, '') AS enrolmethod,\n                ue.timecreated AS enrolledon,\n                COALESCE(cc.timecompleted, 0) AS timecompleted,\n                COALESCE(cc.timestarted, 0) AS timestarted,\n                CASE WHEN gi.id IS NULL THEN 0 ELSE 1 END AS gradeitemexists,\n                CASE WHEN cgg.finalgrade IS NULL THEN 0 ELSE 1 END AS gradeavailable,\n                cgg.finalgrade AS averagegrade\n            FROM {user} u\n            JOIN {user_enrolments} ue ON ue.userid = u.id AND ue.status = 0\n            JOIN {enrol} e ON e.id = ue.enrolid AND e.status = 0 AND e.courseid <> 1\n            JOIN {course} c ON c.id = e.courseid\n            LEFT JOIN {course_completions} cc ON cc.userid = u.id AND cc.course = c.id\n            LEFT JOIN {grade_items} gi ON gi.courseid = c.id AND gi.itemtype = 'course'\n            LEFT JOIN {grade_grades} cgg ON cgg.itemid = gi.id AND cgg.userid = u.id\n            WHERE u.deleted = 0\n              AND u.suspended = 0\n              AND u.id > 0\n              $coursesql\n            GROUP BY\n                u.id, u.firstname, u.lastname,\n                c.id, c.fullname, c.shortname, e.enrol, ue.timecreated,\n                cc.timecompleted, cc.timestarted, gi.id, cgg.finalgrade\n            ORDER BY ue.timecreated DESC, u.lastname ASC, u.firstname ASC\n        ", $params);

        $userids = array_map(static function($record) {
            return (int)$record->userid;
        }, array_values($records));
        $rolemap = self::build_user_role_map($userids);

        $items = [];
        foreach ($records as $record) {
            $userid = (int)$record->userid;
            $coursekey = (int)$record->courseid;
            $lastactivity = (int)($activitymap[$userid][$coursekey] ?? 0);
            $averagegrade = $record->averagegrade === null ? null : round((float)$record->averagegrade, 1);
            $timecompleted = (int)$record->timecompleted;
            $timestarted = (int)$record->timestarted;
            $statuskey = $timecompleted > 0 ? 'completed' : (($timestarted > 0 || $lastactivity > 0) ? 'in_progress' : 'not_started');
            $items[] = [
                'user_id' => $userid,
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
                'role_label' => self::role_label($rolemap[$userid] ?? []),
                'course_id' => $coursekey,
                'course_name' => trim((string)$record->coursefullname),
                'course_short_name' => trim((string)$record->courseshortname),
                'enrolment_method' => trim((string)$record->enrolmethod),
                'enrolment_method_label' => self::humanize_enrolment_method((string)$record->enrolmethod),
                'enrolled_on' => (int)$record->enrolledon > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->enrolledon) : '',
                'status_key' => $statuskey,
                'status_label' => self::humanize_status_key($statuskey),
                'grade_item_exists' => (int)$record->gradeitemexists === 1,
                'grade_available' => (int)$record->gradeavailable === 1,
                'average_grade' => $averagegrade,
                'last_action_ts' => $lastactivity,
                'last_action_at' => $lastactivity > 0 ? gmdate(\DateTimeInterface::ATOM, $lastactivity) : '',
            ];
        }

        usort($items, static function(array $left, array $right): int {
            $lastcompare = (int)$right['last_action_ts'] <=> (int)$left['last_action_ts'];
            if ($lastcompare !== 0) {
                return $lastcompare;
            }

            $leftenrolled = trim((string)$left['enrolled_on']);
            $rightenrolled = trim((string)$right['enrolled_on']);
            if ($leftenrolled !== $rightenrolled) {
                return strcmp($rightenrolled, $leftenrolled);
            }

            $coursecompare = strcmp((string)$left['course_name'], (string)$right['course_name']);
            if ($coursecompare !== 0) {
                return $coursecompare;
            }

            return strcmp((string)$left['user_name'], (string)$right['user_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_at_risk_users(array $filters): array {
        $cachekey = self::cache_key('at_risk_users', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        $userstatus = self::collect_user_status($filters);
        $items = [];

        foreach ($userstatus as $row) {
            $reasons = [];
            $riskscore = 0;
            $statuskey = (string)($row['status_key'] ?? 'not_started');
            $averagegrade = $row['average_grade'];
            $hasactivity = trim((string)($row['last_action_at'] ?? '')) !== '';
            $gradeitemexists = !empty($row['grade_item_exists']);
            $gradeavailable = !empty($row['grade_available']);

            if (!$hasactivity) {
                $reasons[] = 'No activity in selected period';
                $riskscore += 2;
            }

            if ($gradeitemexists && !$gradeavailable) {
                $reasons[] = 'No grade recorded yet';
                $riskscore += 1;
            } else if ($gradeavailable && $averagegrade !== null && (float)$averagegrade <= 60.0) {
                $reasons[] = 'Average grade is 60 or below';
                $riskscore += 2;
            }

            if (($statuskey === 'not_started' || $statuskey === 'in_progress') && !$hasactivity) {
                $reasons[] = $statuskey === 'not_started'
                    ? 'Learner has not started the course'
                    : 'Learner is in progress without recent activity';
                $riskscore += 2;
            }

            if (empty($reasons)) {
                continue;
            }

            $items[] = [
                'user_name' => (string)$row['user_name'],
                'role_label' => (string)$row['role_label'],
                'course_name' => (string)$row['course_name'],
                'status_label' => (string)$row['status_label'],
                'average_grade' => $averagegrade,
                'last_action_at' => (string)$row['last_action_at'],
                'risk_score' => $riskscore,
                'risk_reason' => implode('; ', array_unique($reasons)),
            ];
        }

        usort($items, static function(array $left, array $right): int {
            $scorecompare = (int)$right['risk_score'] <=> (int)$left['risk_score'];
            if ($scorecompare !== 0) {
                return $scorecompare;
            }
            $leftlast = trim((string)$left['last_action_at']);
            $rightlast = trim((string)$right['last_action_at']);
            if ($leftlast === '' && $rightlast !== '') {
                return -1;
            }
            if ($leftlast !== '' && $rightlast === '') {
                return 1;
            }
            return strcmp((string)$left['course_name'], (string)$right['course_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_activity_stats_summary(array $filters): array {
        $cachekey = self::cache_key('activity_stats_summary', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $items = [];
        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];

        if (self::table_exists('local_mpilot_rpt_log') && self::table_exists('course_modules') && self::table_has_records_select('local_mpilot_rpt_log', 'bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts, $startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND c.id = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_recordset_sql("\n                SELECT\n                    c.id AS courseid,\n                    c.fullname AS coursefullname,\n                    cm.id AS activityid,\n                    m.name AS moduletype,\n                    COALESCE(NULLIF(MAX(t.page_label), ''), '') AS activitylabel,\n                    COALESCE(SUM(l.visits), 0) AS visits,\n                    COALESCE(SUM(l.time_spent), 0) AS timespent,\n                    COUNT(DISTINCT t.userid) AS uniqueusers,\n                    COALESCE(MAX(l.last_access), 0) AS lastactivity,\n                    COALESCE(MIN(NULLIF(t.first_access, 0)), 0) AS firstaccess,\n                    COALESCE(MAX(cm.added), 0) AS createdat,\n                    COALESCE(MAX(eventagg.totalevents), 0) AS totalevents,\n                    COALESCE(MAX(completionagg.completedusers), 0) AS numcompleted\n                FROM {local_mpilot_rpt_log} l\n                JOIN {local_mpilot_rpt_track} t ON t.id = l.trackid AND t.page_type = 'module'\n                JOIN {course_modules} cm ON cm.id = t.page_instance\n                JOIN {modules} m ON m.id = cm.module\n                JOIN {course} c ON c.id = cm.course AND c.id <> 1\n                LEFT JOIN (\n                    SELECT page_instance, COUNT(*) AS totalevents\n                    FROM {local_mpilot_rpt_event}\n                    WHERE page_type = 'module'\n                      AND timecreated BETWEEN ? AND ?\n                    GROUP BY page_instance\n                ) eventagg ON eventagg.page_instance = cm.id\n                LEFT JOIN (\n                    SELECT coursemoduleid, COUNT(DISTINCT userid) AS completedusers\n                    FROM {course_modules_completion}\n                    WHERE completionstate > 0\n                    GROUP BY coursemoduleid\n                ) completionagg ON completionagg.coursemoduleid = cm.id\n                WHERE l.bucket_start BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY c.id, c.fullname, cm.id, m.name\n                ORDER BY COALESCE(SUM(l.visits), 0) DESC, COALESCE(SUM(l.time_spent), 0) DESC, COALESCE(MAX(l.last_access), 0) DESC\n            ", $params);

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
            $records->close();

            self::$cache[$cachekey] = $items;
            return $items;
        }

        $records = [];
        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND e.courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_recordset_sql("\n                SELECT\n                    COALESCE(c.id, 0) AS courseid,\n                    COALESCE(c.fullname, '') AS coursefullname,\n                    COALESCE(NULLIF(e.component, ''), 'core') AS component,\n                    COALESCE(NULLIF(e.target, ''), 'activity') AS target,\n                    COUNT(*) AS totalevents,\n                    COUNT(DISTINCT e.userid) AS uniqueusers,\n                    MAX(e.timecreated) AS lastactivity\n                FROM {local_mpilot_rpt_event} e\n                LEFT JOIN {course} c ON c.id = e.courseid\n                WHERE e.userid > 0\n                  AND e.timecreated BETWEEN ? AND ?\n                  AND (e.courseid IS NULL OR e.courseid <> 1)\n                  $coursesql\n                GROUP BY c.id, c.fullname, component, target\n                ORDER BY COUNT(*) DESC, MAX(e.timecreated) DESC\n            ", $params);
        } else if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND l.courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_recordset_sql("\n                SELECT\n                    COALESCE(c.id, 0) AS courseid,\n                    COALESCE(c.fullname, '') AS coursefullname,\n                    COALESCE(NULLIF(l.component, ''), 'core') AS component,\n                    COALESCE(NULLIF(l.target, ''), 'activity') AS target,\n                    COUNT(*) AS totalevents,\n                    COUNT(DISTINCT l.userid) AS uniqueusers,\n                    MAX(l.timecreated) AS lastactivity\n                FROM {logstore_standard_log} l\n                LEFT JOIN {course} c ON c.id = l.courseid\n                WHERE l.userid > 0\n                  AND l.timecreated BETWEEN ? AND ?\n                  AND (l.courseid IS NULL OR l.courseid <> 1)\n                  $coursesql\n                GROUP BY c.id, c.fullname, component, target\n                ORDER BY COUNT(*) DESC, MAX(l.timecreated) DESC\n            ", $params);
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
        if ($records instanceof \moodle_recordset) {
            $records->close();
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_activity_completion_detail(array $filters): array {
        $cachekey = self::cache_key('activity_completion_detail', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('course_modules') || !self::table_exists('modules') || !self::table_exists('course_modules_completion')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $courseid = (int)$filters['course_id'];
        $enrolledusers = self::collect_enrolled_users_by_course($filters);
        if (empty($enrolledusers)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $params = [];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $labeljoin = '';
        $labelfield = "'' AS activitylabel";
        if (self::table_exists('local_mpilot_rpt_track')) {
            $labeljoin = "LEFT JOIN (
                    SELECT page_instance, COALESCE(NULLIF(MAX(page_label), ''), '') AS pagelabel
                    FROM {local_mpilot_rpt_track}
                    WHERE page_type = 'module'
                    GROUP BY page_instance
                ) labelagg ON labelagg.page_instance = cm.id";
            $labelfield = "COALESCE(labelagg.pagelabel, '') AS activitylabel";
        }

        $records = $DB->get_records_sql("
            SELECT
                cm.id AS activityid,
                c.id AS courseid,
                c.fullname AS coursefullname,
                m.name AS moduletype,
                $labelfield
            FROM {course_modules} cm
            JOIN {course} c ON c.id = cm.course AND c.id <> 1
            JOIN {modules} m ON m.id = cm.module
            $labeljoin
            WHERE cm.completion > 0
              $coursesql
            ORDER BY c.fullname ASC, m.name ASC, cm.id ASC
        ", $params);

        if (empty($records)) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $completionmap = [];
        $completionparams = [];
        $completionjoinsql = '';
        $completioncoursesql = '';
        if ($courseid > 0) {
            $completionjoinsql = ' JOIN {course_modules} cm ON cm.id = cmc.coursemoduleid';
            $completioncoursesql = ' AND cm.course = ?';
            $completionparams[] = $courseid;
        }

        $completions = $DB->get_recordset_sql("
            SELECT
                cmc.coursemoduleid,
                cmc.userid,
                cmc.completionstate,
                cmc.timemodified
            FROM {course_modules_completion} cmc
            $completionjoinsql
            WHERE cmc.userid > 0
              $completioncoursesql
        ", $completionparams);

        foreach ($completions as $completion) {
            $completionmap[(int)$completion->coursemoduleid . ':' . (int)$completion->userid] = [
                'completion_state' => (int)$completion->completionstate,
                'completion_at' => (int)$completion->timemodified,
            ];
        }
        $completions->close();

        $lastactivitymap = self::build_module_last_activity_map($filters);
        $items = [];

        foreach ($records as $record) {
            $courseusers = $enrolledusers[(int)$record->courseid] ?? [];
            if (empty($courseusers)) {
                continue;
            }

            $activityid = (int)$record->activityid;
            $activityname = self::activity_label_for_module((string)$record->activitylabel, (string)$record->moduletype, $activityid);
            $componentname = self::humanize_component_label('mod_' . trim((string)$record->moduletype));
            foreach ($courseusers as $user) {
                $completion = $completionmap[$activityid . ':' . (int)$user['user_id']] ?? ['completion_state' => 0, 'completion_at' => 0];
                $completionstate = (int)$completion['completion_state'];
                $completionat = (int)$completion['completion_at'];
                $lastactivity = (int)($lastactivitymap[(int)$user['user_id']][$activityid] ?? 0);

                $items[] = [
                    'course_id' => (int)$record->courseid,
                    'course_name' => trim((string)$record->coursefullname),
                    'activity_id' => $activityid,
                    'activity_name' => $activityname,
                    'module_type' => trim((string)$record->moduletype),
                    'component_name' => $componentname,
                    'user_id' => (int)$user['user_id'],
                    'user_name' => (string)$user['user_name'],
                    'completion_state' => $completionstate,
                    'completion_state_key' => self::completion_state_key($completionstate),
                    'completion_state_label' => self::humanize_completion_state($completionstate),
                    'completion_at' => $completionat > 0 ? gmdate(\DateTimeInterface::ATOM, $completionat) : '',
                    'last_action_at' => $lastactivity > 0 ? gmdate(\DateTimeInterface::ATOM, $lastactivity) : '',
                ];
            }
        }

        usort($items, static function(array $left, array $right): int {
            $leftstate = self::completion_state_sort_order((int)$left['completion_state']);
            $rightstate = self::completion_state_sort_order((int)$right['completion_state']);
            if ($leftstate !== $rightstate) {
                return $leftstate <=> $rightstate;
            }

            $leftlast = trim((string)$left['last_action_at']);
            $rightlast = trim((string)$right['last_action_at']);
            if ($leftlast !== $rightlast) {
                return strcmp($rightlast, $leftlast);
            }

            $coursecompare = strcmp((string)$left['course_name'], (string)$right['course_name']);
            if ($coursecompare !== 0) {
                return $coursecompare;
            }

            $activitycompare = strcmp((string)$left['activity_name'], (string)$right['activity_name']);
            if ($activitycompare !== 0) {
                return $activitycompare;
            }

            return strcmp((string)$left['user_name'], (string)$right['user_name']);
        });

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_quiz_activity_detail(array $filters): array {
        $cachekey = self::cache_key('quiz_activity_detail', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('quiz_attempts') || !self::table_exists('quiz')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $params = [$startts, $endts, $startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $records = $DB->get_recordset_sql("\n            SELECT\n                q.id AS quizid,\n                q.name AS quizname,\n                c.id AS courseid,\n                c.fullname AS coursefullname,\n                u.id AS userid,\n                u.firstname,\n                u.lastname,\n                COUNT(qa.id) AS attempts,\n                SUM(CASE WHEN qa.state = 'finished' THEN 1 ELSE 0 END) AS finishedattempts,\n                ROUND(COALESCE(MAX(qa.sumgrades), 0), 1) AS bestscore,\n                ROUND(COALESCE(AVG(qa.sumgrades), 0), 1) AS averagescore,\n                ROUND(COALESCE(MIN(qa.sumgrades), 0), 1) AS lowestscore,\n                MAX(qa.timemodified) AS lastattempt,\n                MAX(CASE WHEN qa.timefinish > qa.timestart THEN qa.timefinish ELSE 0 END) AS completionat,\n                COALESCE(MAX(trackagg.timespent), 0) AS trackedseconds,\n                COALESCE(SUM(CASE WHEN qa.timefinish > qa.timestart THEN qa.timefinish - qa.timestart ELSE 0 END), 0) AS attemptseconds\n            FROM {quiz_attempts} qa\n            JOIN {quiz} q ON q.id = qa.quiz\n            JOIN {course} c ON c.id = q.course AND c.id <> 1\n            JOIN {user} u ON u.id = qa.userid\n            LEFT JOIN {modules} m ON m.name = 'quiz'\n            LEFT JOIN {course_modules} cm ON cm.instance = q.id AND cm.module = m.id\n            LEFT JOIN (\n                SELECT\n                    t.userid,\n                    t.page_instance AS cmid,\n                    COALESCE(SUM(l.time_spent), 0) AS timespent\n                FROM {local_mpilot_rpt_track} t\n                JOIN {local_mpilot_rpt_log} l ON l.trackid = t.id\n                WHERE t.page_type = 'module'\n                  AND l.bucket_start BETWEEN ? AND ?\n                GROUP BY t.userid, t.page_instance\n            ) trackagg ON trackagg.userid = qa.userid AND trackagg.cmid = cm.id\n            WHERE qa.userid > 0\n              AND qa.timemodified BETWEEN ? AND ?\n              $coursesql\n            GROUP BY q.id, q.name, c.id, c.fullname, u.id, u.firstname, u.lastname\n            ORDER BY MAX(qa.timemodified) DESC\n        ", $params);

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
        $records->close();

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_quiz_question_analysis(array $filters): array {
        $cachekey = self::cache_key('quiz_question_analysis', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('quiz_attempts') || !self::table_exists('question_attempts')
            || !self::table_exists('question_attempt_steps') || !self::table_exists('question')
            || !self::table_exists('quiz_slots')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $params = [$startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND c.id = ?';
            $params[] = $courseid;
        }

        $records = $DB->get_recordset_sql("
            SELECT
                qz.id AS quizid,
                qz.name AS quizname,
                c.id AS courseid,
                c.fullname AS coursefullname,
                q.id AS questionid,
                COALESCE(q.name, '') AS questionname,
                COALESCE(q.qtype, '') AS questiontype,
                COUNT(*) AS attemptcount,
                ROUND(COALESCE(AVG(COALESCE(lateststep.fraction, 0) * 100), 0), 1) AS averagescore,
                SUM(CASE WHEN COALESCE(lateststep.fraction, 0) >= 0.999999 THEN 1 ELSE 0 END) AS correctcount,
                MAX(lateststep.timecreated) AS lastattempt
            FROM {quiz_attempts} qa
            JOIN {quiz} qz ON qz.id = qa.quiz
            JOIN {course} c ON c.id = qz.course AND c.id <> 1
            JOIN {question_attempts} qatt ON qatt.questionusageid = qa.uniqueid
            JOIN {quiz_slots} qs ON qs.quizid = qz.id AND qs.slot = qatt.slot
            JOIN {question} q ON q.id = qatt.questionid
            JOIN (
                SELECT
                    steps.questionattemptid,
                    steps.fraction,
                    steps.timecreated
                FROM {question_attempt_steps} steps
                JOIN (
                    SELECT questionattemptid, MAX(sequencenumber) AS latestsequence
                    FROM {question_attempt_steps}
                    GROUP BY questionattemptid
                ) latestseq
                  ON latestseq.questionattemptid = steps.questionattemptid
                 AND latestseq.latestsequence = steps.sequencenumber
            ) lateststep ON lateststep.questionattemptid = qatt.id
            WHERE qa.preview = 0
              AND qa.timemodified BETWEEN ? AND ?
              $coursesql
            GROUP BY qz.id, qz.name, c.id, c.fullname, q.id, q.name, q.qtype
            ORDER BY
                ROUND(COALESCE((SUM(CASE WHEN COALESCE(lateststep.fraction, 0) >= 0.999999 THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 0), 1) ASC,
                COUNT(*) DESC,
                MAX(lateststep.timecreated) DESC
        ", $params);

        $items = [];
        foreach ($records as $record) {
            $attempts = (int)$record->attemptcount;
            $correctrate = $attempts > 0
                ? round(((int)$record->correctcount / $attempts) * 100, 1)
                : 0.0;
            $questionname = trim((string)$record->questionname);
            if ($questionname === '') {
                $questionname = 'Question #' . (int)$record->questionid;
            }

            $items[] = [
                'quiz_id' => (int)$record->quizid,
                'quiz_name' => trim((string)$record->quizname),
                'course_id' => (int)$record->courseid,
                'course_name' => trim((string)$record->coursefullname),
                'question_id' => (int)$record->questionid,
                'question_name' => $questionname,
                'question_type' => trim((string)$record->questiontype),
                'attempts' => $attempts,
                'correct_rate' => $correctrate,
                'average_score' => (float)$record->averagescore,
                'last_attempt_at' => (int)$record->lastattempt > 0 ? gmdate(\DateTimeInterface::ATOM, (int)$record->lastattempt) : '',
            ];
        }
        $records->close();

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_enrolled_users_by_course(array $filters): array {
        $cachekey = self::cache_key('enrolled_users_by_course', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        if (!self::table_exists('enrol') || !self::table_exists('user_enrolments') || !self::table_exists('user')) {
            self::$cache[$cachekey] = [];
            return [];
        }

        $courseid = (int)$filters['course_id'];
        $params = [];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND e.courseid = ?';
            $params[] = $courseid;
        }

        $records = $DB->get_recordset_sql("
            SELECT DISTINCT
                e.courseid,
                u.id AS userid,
                COALESCE(u.firstname, '') AS firstname,
                COALESCE(u.lastname, '') AS lastname
            FROM {enrol} e
            JOIN {user_enrolments} ue ON ue.enrolid = e.id AND ue.status = 0
            JOIN {user} u ON u.id = ue.userid AND u.deleted = 0 AND u.suspended = 0
            WHERE e.status = 0
              AND e.courseid <> 1
              $coursesql
            ORDER BY courseid ASC, lastname ASC, firstname ASC
        ", $params);

        $items = [];
        foreach ($records as $record) {
            $resolvedcourseid = (int)$record->courseid;
            $userid = (int)$record->userid;
            if (!isset($items[$resolvedcourseid])) {
                $items[$resolvedcourseid] = [];
            }
            $items[$resolvedcourseid][$userid] = [
                'user_id' => $userid,
                'user_name' => trim($record->firstname . ' ' . $record->lastname),
            ];
        }
        $records->close();

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function build_module_last_activity_map(array $filters): array {
        $cachekey = self::cache_key('module_last_activity_map', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $items = [];

        if (self::table_exists('local_mpilot_rpt_track')) {
            $params = ['module', $startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND t.courseid = ?';
                $params[] = $courseid;
            }

            $records = $DB->get_recordset_sql("
                SELECT
                    t.userid,
                    t.page_instance AS activityid,
                    MAX(t.last_access) AS lastaction
                FROM {local_mpilot_rpt_track} t
                WHERE t.userid > 0
                  AND t.page_type = ?
                  AND t.page_instance > 0
                  AND t.last_access BETWEEN ? AND ?
                  $coursesql
                GROUP BY t.userid, t.page_instance
            ", $params);

            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $activityid = (int)$record->activityid;
                if (!isset($items[$userid])) {
                    $items[$userid] = [];
                }
                $items[$userid][$activityid] = max((int)($items[$userid][$activityid] ?? 0), (int)$record->lastaction);
            }
            $records->close();
        }

        if (self::table_exists('logstore_standard_log') && self::table_exists('course_modules')) {
            $params = [CONTEXT_MODULE, $startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND cm.course = ?';
                $params[] = $courseid;
            }

            $records = $DB->get_recordset_sql("
                SELECT
                    l.userid,
                    l.contextinstanceid AS activityid,
                    MAX(l.timecreated) AS lastaction
                FROM {logstore_standard_log} l
                JOIN {course_modules} cm ON cm.id = l.contextinstanceid
                WHERE l.userid > 0
                  AND l.contextlevel = ?
                  AND l.contextinstanceid > 0
                  AND l.timecreated BETWEEN ? AND ?
                  $coursesql
                GROUP BY l.userid, l.contextinstanceid
            ", $params);

            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $activityid = (int)$record->activityid;
                if (!isset($items[$userid])) {
                    $items[$userid] = [];
                }
                $items[$userid][$activityid] = max((int)($items[$userid][$activityid] ?? 0), (int)$record->lastaction);
            }
            $records->close();
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function build_session_stats(array $filters): array {
        $cachekey = self::cache_key('session_stats', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $result = [
            'average_session_seconds' => 0,
            'total_sessions' => 0,
            'per_user' => [],
        ];

        if (self::table_has_records_select('local_mpilot_rpt_log', 'bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND (t.courseid = ? OR (t.page_type = ? AND t.page_instance = ?))';
                $params[] = $courseid;
                $params[] = 'course';
                $params[] = $courseid;
            }

            $records = $DB->get_records_sql("\n                SELECT\n                    t.userid,\n                    COALESCE(SUM(l.session_starts), 0) AS sessions,\n                    COALESCE(SUM(l.time_spent), 0) AS totalonlineseconds,\n                    MAX(l.last_access) AS lastactivity\n                FROM {local_mpilot_rpt_log} l\n                JOIN {local_mpilot_rpt_track} t ON t.id = l.trackid\n                WHERE t.userid > 0\n                  AND l.bucket_start BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY t.userid\n            ", $params);

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

            $result['total_sessions'] = $totalsessions;
            if ($totalsessions > 0) {
                $result['average_session_seconds'] = (int)round($totalseconds / $totalsessions);
            }

            self::$cache[$cachekey] = $result;
            return $result;
        }

        if (!self::table_exists('logstore_standard_log')) {
            self::$cache[$cachekey] = $result;
            return $result;
        }

        $params = [$startts, $endts];
        $select = 'userid > 0 AND timecreated BETWEEN ? AND ?';
        if ($courseid > 0) {
            $select .= ' AND courseid = ?';
            $params[] = $courseid;
        }
        $recordset = $DB->get_recordset_select('logstore_standard_log', $select, $params, 'userid ASC, timecreated ASC', 'userid, timecreated');

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

        $result['total_sessions'] = $totalsessions;
        if ($totalsessions > 0) {
            $result['average_session_seconds'] = (int)round($totalseconds / $totalsessions);
        }

        self::$cache[$cachekey] = $result;
        return $result;
    }

    private static function collect_active_user_ids(array $filters, array $sessionstats): array {
        $cachekey = self::cache_key('active_user_ids', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        $userids = array_keys($sessionstats['per_user'] ?? []);
        if (!empty($userids)) {
            sort($userids);
            self::$cache[$cachekey] = $userids;
            return $userids;
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $userids = [];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT DISTINCT userid\n                FROM {local_mpilot_rpt_event}\n                WHERE userid > 0\n                  AND timecreated BETWEEN ? AND ?\n                  $coursesql\n            ", $params);
            $userids = array_map(static function($record) {
                return (int)$record->userid;
            }, array_values($records));
            sort($userids);
            self::$cache[$cachekey] = $userids;
            return $userids;
        }

        if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts];
            $select = 'userid > 0 AND timecreated BETWEEN ? AND ?';
            if ($courseid > 0) {
                $select .= ' AND courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_select('logstore_standard_log', $select, $params, '', 'DISTINCT userid');
            foreach ($records as $record) {
                $userids[] = (int)$record->userid;
            }
            sort($userids);
        }

        self::$cache[$cachekey] = $userids;
        return $userids;
    }

    private static function collect_activity_users_and_seconds_by_day(array $filters): array {
        $cachekey = self::cache_key('activity_users_by_day', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $items = [];

        if (self::table_has_records_select('local_mpilot_rpt_detail', 'userid > 0 AND bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_recordset_sql("\n                SELECT\n                    " . self::sql_day_bucket('bucket_start') . " AS daybucket,\n                    userid,\n                    COALESCE(SUM(active_seconds), 0) AS activeseconds\n                FROM {local_mpilot_rpt_detail}\n                WHERE userid > 0\n                  AND bucket_start BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY daybucket, userid\n            ", $params);

            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                if (!isset($items[$daybucket])) {
                    $items[$daybucket] = ['users' => [], 'session_time_seconds' => 0];
                }
                $items[$daybucket]['users'][(int)$record->userid] = true;
                $items[$daybucket]['session_time_seconds'] += (int)$record->activeseconds;
            }
            $records->close();

            self::$cache[$cachekey] = $items;
            return $items;
        }

        if (self::table_has_records_select('local_mpilot_rpt_log', 'bucket_start BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND (t.courseid = ? OR (t.page_type = ? AND t.page_instance = ?))';
                $params[] = $courseid;
                $params[] = 'course';
                $params[] = $courseid;
            }
            $records = $DB->get_recordset_sql("\n                SELECT\n                    " . self::sql_day_bucket('l.bucket_start') . " AS daybucket,\n                    t.userid,\n                    COALESCE(SUM(l.time_spent), 0) AS activeseconds\n                FROM {local_mpilot_rpt_log} l\n                JOIN {local_mpilot_rpt_track} t ON t.id = l.trackid\n                WHERE t.userid > 0\n                  AND l.bucket_start BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY daybucket, t.userid\n            ", $params);

            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                if (!isset($items[$daybucket])) {
                    $items[$daybucket] = ['users' => [], 'session_time_seconds' => 0];
                }
                $items[$daybucket]['users'][(int)$record->userid] = true;
                $items[$daybucket]['session_time_seconds'] += (int)$record->activeseconds;
            }
            $records->close();

            self::$cache[$cachekey] = $items;
            return $items;
        }

        if (!self::table_exists('logstore_standard_log')) {
            self::$cache[$cachekey] = $items;
            return $items;
        }

        $params = [$startts, $endts];
        $select = 'userid > 0 AND timecreated BETWEEN ? AND ?';
        if ($courseid > 0) {
            $select .= ' AND courseid = ?';
            $params[] = $courseid;
        }
        $recordset = $DB->get_recordset_select('logstore_standard_log', $select, $params, 'userid ASC, timecreated ASC', 'userid, timecreated');

        $currentuserid = 0;
        $sessionstart = 0;
        $lasttime = 0;
        foreach ($recordset as $record) {
            $userid = (int)$record->userid;
            $timecreated = (int)$record->timecreated;
            if ($userid !== $currentuserid || $lasttime === 0 || ($timecreated - $lasttime) > 1800) {
                if ($currentuserid > 0 && $sessionstart > 0 && $lasttime > 0) {
                    $duration = max(60, $lasttime - $sessionstart);
                    $daybucket = self::day_bucket($sessionstart);
                    if (!isset($items[$daybucket])) {
                        $items[$daybucket] = ['users' => [], 'session_time_seconds' => 0];
                    }
                    $items[$daybucket]['users'][$currentuserid] = true;
                    $items[$daybucket]['session_time_seconds'] += $duration;
                }
                $currentuserid = $userid;
                $sessionstart = $timecreated;
            }
            $lasttime = $timecreated;
        }
        $recordset->close();

        if ($currentuserid > 0 && $sessionstart > 0 && $lasttime > 0) {
            $duration = max(60, $lasttime - $sessionstart);
            $daybucket = self::day_bucket($sessionstart);
            if (!isset($items[$daybucket])) {
                $items[$daybucket] = ['users' => [], 'session_time_seconds' => 0];
            }
            $items[$daybucket]['users'][$currentuserid] = true;
            $items[$daybucket]['session_time_seconds'] += $duration;
        }

        self::$cache[$cachekey] = $items;
        return $items;
    }

    private static function collect_login_counts_by_day(array $filters, array $activitybyday): array {
        $cachekey = self::cache_key('login_counts_by_day', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $counts = [];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            $records = $DB->get_recordset_sql("\n                SELECT\n                    " . self::sql_day_bucket('timecreated') . " AS daybucket,\n                    userid\n                FROM {local_mpilot_rpt_event}\n                WHERE userid > 0\n                  AND eventname = ?\n                  AND timecreated BETWEEN ? AND ?\n                ORDER BY timecreated ASC\n            ", ['\\core\\event\\user_loggedin', $startts, $endts]);

            if ($courseid <= 0) {
                foreach ($records as $record) {
                    $daybucket = (int)$record->daybucket;
                    if (!isset($counts[$daybucket])) {
                        $counts[$daybucket] = 0;
                    }
                    $counts[$daybucket]++;
                }
            } else {
                foreach ($records as $record) {
                    $daybucket = (int)$record->daybucket;
                    $userid = (int)$record->userid;
                    if (!isset($activitybyday[$daybucket]['users'][$userid])) {
                        continue;
                    }
                    if (!isset($counts[$daybucket])) {
                        $counts[$daybucket] = 0;
                    }
                    $counts[$daybucket]++;
                }
            }
            $records->close();

            self::$cache[$cachekey] = $counts;
            return $counts;
        }

        if (!self::table_exists('logstore_standard_log')) {
            self::$cache[$cachekey] = $counts;
            return $counts;
        }

        $records = $DB->get_recordset_sql("\n            SELECT\n                " . self::sql_day_bucket('timecreated') . " AS daybucket,\n                userid\n            FROM {logstore_standard_log}\n            WHERE userid > 0\n              AND target = ?\n              AND action = ?\n              AND timecreated BETWEEN ? AND ?\n            ORDER BY timecreated ASC\n        ", ['user', 'loggedin', $startts, $endts]);

        if ($courseid <= 0) {
            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                if (!isset($counts[$daybucket])) {
                    $counts[$daybucket] = 0;
                }
                $counts[$daybucket]++;
            }
        } else {
            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                $userid = (int)$record->userid;
                if (!isset($activitybyday[$daybucket]['users'][$userid])) {
                    continue;
                }
                if (!isset($counts[$daybucket])) {
                    $counts[$daybucket] = 0;
                }
                $counts[$daybucket]++;
            }
        }
        $records->close();

        self::$cache[$cachekey] = $counts;
        return $counts;
    }

    private static function collect_submissions_by_day(array $filters): array {
        $cachekey = self::cache_key('submissions_by_day', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $counts = [];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            [$eventsql, $eventparams] = $DB->get_in_or_equal([
                '\\mod_assign\\event\\assessable_submitted',
                '\\mod_quiz\\event\\attempt_submitted',
            ], SQL_PARAMS_QM);
            $params = array_merge($eventparams, [$startts, $endts]);
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    " . self::sql_day_bucket('timecreated') . " AS daybucket,\n                    COUNT(*) AS total\n                FROM {local_mpilot_rpt_event}\n                WHERE userid > 0\n                  AND eventname $eventsql\n                  AND timecreated BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY daybucket\n            ", $params);
            foreach ($records as $record) {
                $counts[(int)$record->daybucket] = (int)$record->total;
            }
            self::$cache[$cachekey] = $counts;
            return $counts;
        }

        if (self::table_exists('assign_submission')) {
            $params = [$startts, $endts, 'submitted'];
            $joinsql = '';
            $coursesql = '';
            if ($courseid > 0 && self::table_exists('assign')) {
                $joinsql = ' JOIN {assign} a ON a.id = s.assignment';
                $coursesql = ' AND a.course = ?';
                $params[] = $courseid;
            }

            $records = $DB->get_records_sql("\n                SELECT\n                    " . self::sql_day_bucket('s.timemodified') . " AS daybucket,\n                    COUNT(*) AS total\n                FROM {assign_submission} s\n                $joinsql\n                WHERE s.userid > 0\n                  AND s.timemodified BETWEEN ? AND ?\n                  AND s.status = ?\n                  $coursesql\n                GROUP BY daybucket\n            ", $params);
            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                $counts[$daybucket] = (int)($counts[$daybucket] ?? 0) + (int)$record->total;
            }
        }

        if (self::table_exists('quiz_attempts')) {
            $params = [$startts, $endts];
            $joinsql = '';
            $coursesql = '';
            if ($courseid > 0 && self::table_exists('quiz')) {
                $joinsql = ' JOIN {quiz} q ON q.id = qa.quiz';
                $coursesql = ' AND q.course = ?';
                $params[] = $courseid;
            }

            $records = $DB->get_records_sql("\n                SELECT\n                    " . self::sql_day_bucket('qa.timemodified') . " AS daybucket,\n                    COUNT(*) AS total\n                FROM {quiz_attempts} qa\n                $joinsql\n                WHERE qa.userid > 0\n                  AND qa.timemodified BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY daybucket\n            ", $params);
            foreach ($records as $record) {
                $daybucket = (int)$record->daybucket;
                $counts[$daybucket] = (int)($counts[$daybucket] ?? 0) + (int)$record->total;
            }
        }

        self::$cache[$cachekey] = $counts;
        return $counts;
    }

    private static function collect_completions_by_day(array $filters): array {
        $cachekey = self::cache_key('completions_by_day', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $counts = [];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            [$eventsql, $eventparams] = $DB->get_in_or_equal([
                '\\core\\event\\course_module_completion_updated',
                '\\core\\event\\course_completed',
            ], SQL_PARAMS_QM);
            $params = array_merge($eventparams, [$startts, $endts]);
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $params[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT\n                    " . self::sql_day_bucket('timecreated') . " AS daybucket,\n                    COUNT(*) AS total\n                FROM {local_mpilot_rpt_event}\n                WHERE userid > 0\n                  AND eventname $eventsql\n                  AND timecreated BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY daybucket\n            ", $params);
            foreach ($records as $record) {
                $counts[(int)$record->daybucket] = (int)$record->total;
            }
            self::$cache[$cachekey] = $counts;
            return $counts;
        }

        if (!self::table_exists('course_completions')) {
            self::$cache[$cachekey] = $counts;
            return $counts;
        }

        $params = [$startts, $endts];
        $coursesql = '';
        if ($courseid > 0) {
            $coursesql = ' AND course = ?';
            $params[] = $courseid;
        }
        $records = $DB->get_records_sql("\n            SELECT\n                " . self::sql_day_bucket('timecompleted') . " AS daybucket,\n                COUNT(*) AS total\n            FROM {course_completions}\n            WHERE timecompleted BETWEEN ? AND ?\n              AND timecompleted > 0\n              $coursesql\n            GROUP BY daybucket\n        ", $params);
        foreach ($records as $record) {
            $counts[(int)$record->daybucket] = (int)$record->total;
        }

        self::$cache[$cachekey] = $counts;
        return $counts;
    }

    private static function count_submissions(array $filters): int {
        $counts = self::collect_submissions_by_day($filters);
        return array_sum($counts);
    }

    private static function count_completions(array $filters): int {
        $counts = self::collect_completions_by_day($filters);
        return array_sum($counts);
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
        $records = $DB->get_records_sql("\n            SELECT ra.userid, r.shortname\n            FROM {role_assignments} ra\n            JOIN {role} r ON r.id = ra.roleid\n            WHERE ra.userid $insql\n        ", $params);

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

    private static function build_user_submission_map(array $userids, array $filters): array {
        global $DB;

        if (empty($userids)) {
            return [];
        }

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];

        if (self::table_has_records_select('local_mpilot_rpt_event', 'userid > 0 AND timecreated BETWEEN ? AND ?', [$startts, $endts])) {
            [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
            [$eventsql, $eventparams] = $DB->get_in_or_equal([
                '\\mod_assign\\event\\assessable_submitted',
                '\\mod_quiz\\event\\attempt_submitted',
            ], SQL_PARAMS_QM);
            $coursesql = '';
            $courseparams = [];
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $courseparams[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT userid, COUNT(*) AS total\n                FROM {local_mpilot_rpt_event}\n                WHERE userid $insql\n                  AND eventname $eventsql\n                  AND timecreated BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY userid\n            ", array_merge($params, $eventparams, [$startts, $endts], $courseparams));

            $counts = [];
            foreach ($records as $record) {
                $counts[(int)$record->userid] = (int)$record->total;
            }
            return $counts;
        }

        [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
        $counts = [];

        if (self::table_exists('assign_submission')) {
            $joinsql = '';
            $coursesql = '';
            $courseparams = [];
            if ($courseid > 0 && self::table_exists('assign')) {
                $joinsql = ' JOIN {assign} a ON a.id = s.assignment';
                $coursesql = ' AND a.course = ?';
                $courseparams[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT s.userid, COUNT(*) AS total\n                FROM {assign_submission} s\n                $joinsql\n                WHERE s.userid $insql\n                  AND s.timemodified BETWEEN ? AND ?\n                  AND s.status = 'submitted'\n                  $coursesql\n                GROUP BY s.userid\n            ", array_merge($params, [$startts, $endts], $courseparams));

            foreach ($records as $record) {
                $counts[(int)$record->userid] = (int)$record->total;
            }
        }

        if (self::table_exists('quiz_attempts')) {
            $joinsql = '';
            $coursesql = '';
            $courseparams = [];
            if ($courseid > 0 && self::table_exists('quiz')) {
                $joinsql = ' JOIN {quiz} q ON q.id = qa.quiz';
                $coursesql = ' AND q.course = ?';
                $courseparams[] = $courseid;
            }
            $records = $DB->get_records_sql("\n                SELECT qa.userid, COUNT(*) AS total\n                FROM {quiz_attempts} qa\n                $joinsql\n                WHERE qa.userid $insql\n                  AND qa.timemodified BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY qa.userid\n            ", array_merge($params, [$startts, $endts], $courseparams));

            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $counts[$userid] = (int)($counts[$userid] ?? 0) + (int)$record->total;
            }
        }

        return $counts;
    }

    private static function build_course_last_activity_map(array $filters): array {
        $cachekey = self::cache_key('course_last_activity_map', $filters);
        if (isset(self::$cache[$cachekey])) {
            return self::$cache[$cachekey];
        }

        global $DB;

        $startts = (int)$filters['start_ts'];
        $endts = (int)$filters['end_ts'];
        $courseid = (int)$filters['course_id'];
        $map = [];

        if (self::table_has_records_select('local_mpilot_rpt_track', 'userid > 0 AND last_access BETWEEN ? AND ?', [$startts, $endts])) {
            $params = [$startts, $endts, 'course'];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND (t.courseid = ? OR (t.page_type = ? AND t.page_instance = ?))';
                $params[] = $courseid;
                $params[] = 'course';
                $params[] = $courseid;
            }

            $records = $DB->get_recordset_sql("\n                SELECT\n                    t.userid,\n                    t.courseid,\n                    t.page_type,\n                    t.page_instance,\n                    MAX(t.last_access) AS lastaction\n                FROM {local_mpilot_rpt_track} t\n                WHERE t.userid > 0\n                  AND t.last_access BETWEEN ? AND ?\n                  AND (t.courseid > 0 OR (t.page_type = ? AND t.page_instance > 0))\n                  $coursesql\n                GROUP BY t.userid, t.courseid, t.page_type, t.page_instance\n            ", $params);

            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $derivedcourseid = (int)$record->courseid;
                if ($derivedcourseid <= 0 && trim((string)$record->page_type) === 'course') {
                    $derivedcourseid = (int)$record->page_instance;
                }
                if ($derivedcourseid <= 0) {
                    continue;
                }
                if (!isset($map[$userid])) {
                    $map[$userid] = [];
                }
                $map[$userid][$derivedcourseid] = max((int)($map[$userid][$derivedcourseid] ?? 0), (int)$record->lastaction);
            }
            $records->close();
        }

        if (self::table_exists('logstore_standard_log')) {
            $params = [$startts, $endts];
            $coursesql = '';
            if ($courseid > 0) {
                $coursesql = ' AND courseid = ?';
                $params[] = $courseid;
            }

            $records = $DB->get_recordset_sql("\n                SELECT userid, courseid, MAX(timecreated) AS lastaction\n                FROM {logstore_standard_log}\n                WHERE userid > 0\n                  AND courseid > 1\n                  AND timecreated BETWEEN ? AND ?\n                  $coursesql\n                GROUP BY userid, courseid\n            ", $params);

            foreach ($records as $record) {
                $userid = (int)$record->userid;
                $derivedcourseid = (int)$record->courseid;
                if (!isset($map[$userid])) {
                    $map[$userid] = [];
                }
                $map[$userid][$derivedcourseid] = max((int)($map[$userid][$derivedcourseid] ?? 0), (int)$record->lastaction);
            }
            $records->close();
        }

        self::$cache[$cachekey] = $map;
        return $map;
    }

    private static function paginate_items(array $items, int $limit, int $offset): array {
        $total = count($items);
        if ($limit > 0) {
            $items = array_slice($items, max(0, $offset), $limit);
        }
        return [
            'rows' => array_values($items),
            'total' => $total,
        ];
    }

    private static function build_day_series(array $filters): array {
        $startday = new \DateTimeImmutable(gmdate('Y-m-d 00:00:00', (int)$filters['start_ts']), new \DateTimeZone('UTC'));
        $endday = new \DateTimeImmutable(gmdate('Y-m-d 00:00:00', (int)$filters['end_ts']), new \DateTimeZone('UTC'));
        $days = [];
        for ($cursor = $startday; $cursor <= $endday; $cursor = $cursor->modify('+1 day')) {
            $days[$cursor->getTimestamp()] = $cursor->format('Y-m-d');
        }
        return $days;
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

    private static function sql_day_bucket(string $field): string {
        return 'CAST(FLOOR(' . $field . ' / 86400) AS BIGINT) * 86400';
    }

    private static function day_bucket(int $timestamp): int {
        return (int)strtotime(gmdate('Y-m-d 00:00:00', $timestamp));
    }

    private static function cache_key(string $prefix, array $filters): string {
        return $prefix . ':' . md5(json_encode([
            $filters['period_key'] ?? 'last_7_days',
            (int)($filters['course_id'] ?? 0),
            (int)($filters['start_ts'] ?? 0),
            (int)($filters['end_ts'] ?? 0),
        ]));
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

    private static function humanize_assignment_status_key(string $value): string {
        $value = strtolower(trim($value));
        switch ($value) {
            case 'graded':
                return 'Dinilai';
            case 'late':
                return 'Terlambat';
            case 'submitted':
                return 'Terkumpul';
            case 'missing':
                return 'Belum Mengumpulkan';
            default:
                return 'Belum Submit';
        }
    }

    private static function completion_state_key(int $value): string {
        switch ($value) {
            case 3:
                return 'completed_fail';
            case 2:
                return 'completed_pass';
            case 1:
                return 'completed';
            default:
                return 'not_completed';
        }
    }

    private static function humanize_completion_state(int $value): string {
        switch ($value) {
            case 3:
                return 'Selesai (Gagal)';
            case 2:
                return 'Selesai (Lulus)';
            case 1:
                return 'Selesai';
            default:
                return 'Belum selesai';
        }
    }

    private static function completion_state_sort_order(int $value): int {
        switch ($value) {
            case 0:
                return 0;
            case 3:
                return 1;
            case 2:
                return 2;
            case 1:
                return 3;
            default:
                return 4;
        }
    }

    private static function grade_item_label(string $itemmodule, int $iteminstance, int $gradeitemid): string {
        $itemmodule = trim($itemmodule);
        if ($itemmodule !== '') {
            $label = self::humanize_component_label('mod_' . $itemmodule);
            if ($iteminstance > 0) {
                return $label . ' #' . $iteminstance;
            }
            return $label;
        }

        if ($gradeitemid > 0) {
            return 'Grade item #' . $gradeitemid;
        }

        return 'Grade item';
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
