<?php
define('CLI_SCRIPT', true);
define('NO_OUTPUT_BUFFERING', true);

require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');
require_once($CFG->dirroot . '/lib/completionlib.php');
require_once($CFG->dirroot . '/lib/phpunit/classes/util.php');
require_once($CFG->dirroot . '/admin/tool/generator/classes/backend.php');
require_once($CFG->dirroot . '/admin/tool/generator/classes/testplan_backend.php');

list($options, $unrecognized) = cli_get_params(
    [
        'help' => false,
        'action' => '',
        'shortname' => '',
        'size' => 'M',
        'exportdir' => '',
        'manifest' => '',
    ],
    [
        'h' => 'help',
    ]
);

if (!empty($unrecognized)) {
    cli_error('Unknown options: ' . implode(', ', $unrecognized));
}

if (!empty($options['help']) || empty($options['action']) || empty($options['shortname'])) {
    echo <<<EOF
Moodle report lab helper

Options:
  --action=delete-course|prepare-lab
  --shortname=COURSE_SHORTNAME
  --size=M
  --exportdir=/tmp/report-lab-assets
  --manifest=/tmp/report-lab-assets/manifest.json

Examples:
  php moodle-report-lab-helper.php --action=delete-course --shortname=RPTJM_M_20260322
  php moodle-report-lab-helper.php --action=prepare-lab --shortname=RPTJM_M_20260322 --size=M --exportdir=/tmp/report-lab-assets --manifest=/tmp/report-lab-assets/manifest.json
EOF;
    exit(empty($options['help']) ? 1 : 0);
}

\core\session\manager::set_user(get_admin());

$action = trim((string)$options['action']);
$shortname = trim((string)$options['shortname']);
$size = strtoupper(trim((string)$options['size']));
$exportdir = trim((string)$options['exportdir']);
$manifestpath = trim((string)$options['manifest']);

switch ($action) {
    case 'delete-course':
        delete_lab_course($shortname);
        exit(0);

    case 'prepare-lab':
        $manifest = prepare_lab_course($shortname, $size, $exportdir);
        $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            cli_error('Failed to encode manifest JSON.');
        }
        if ($manifestpath !== '') {
            ensure_directory(dirname($manifestpath));
            file_put_contents($manifestpath, $json . PHP_EOL);
        }
        echo $json . PHP_EOL;
        exit(0);

    default:
        cli_error('Unsupported action: ' . $action);
}

function delete_lab_course(string $shortname): void {
    global $DB;

    $course = $DB->get_record('course', ['shortname' => $shortname], '*', IGNORE_MISSING);
    if (!$course) {
        echo json_encode([
            'deleted' => false,
            'shortname' => $shortname,
            'status' => 'missing',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        return;
    }

    if ((int)$course->id === SITEID) {
        cli_error('Refusing to delete the site course.');
    }

    if (!delete_course($course, false)) {
        cli_error('Failed to delete course: ' . $shortname);
    }

    echo json_encode([
        'deleted' => true,
        'shortname' => $shortname,
        'course_id' => (int)$course->id,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}

function prepare_lab_course(string $shortname, string $size, string $exportdir): array {
    global $DB, $CFG;

    $CFG->noemailever = true;
    set_config('noemailever', 1);

    $generator = phpunit_util::get_data_generator();
    $course = get_lab_course($shortname);

    set_config('enablecompletion', 1);

    if ((int)($course->enablecompletion ?? 0) !== 1) {
        update_course((object)[
            'id' => (int)$course->id,
            'enablecompletion' => 1,
        ]);
        $course = get_lab_course($shortname);
    }

    $prunedassignments = prune_generated_assignments((int)$course->id);

    $page = $generator->create_module('page', [
        'course' => (int)$course->id,
        'name' => 'Report Lab Page',
        'content' => '<p>Report lab page used for heartbeat and completion traffic.</p>',
        'completion' => COMPLETION_TRACKING_MANUAL,
    ], [
        'section' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ]);

    /** @var mod_forum_generator $forumgenerator */
    $forumgenerator = $generator->get_plugin_generator('mod_forum');
    $forum = $forumgenerator->create_instance([
        'course' => (int)$course->id,
        'name' => 'Report Lab Forum',
        'type' => 'general',
        'completion' => COMPLETION_TRACKING_MANUAL,
    ], [
        'section' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ]);

    /** @var mod_assign_generator $assigngenerator */
    $assigngenerator = $generator->get_plugin_generator('mod_assign');
    $assignmentduedate = time() + (DAYSECS * 2);
    $assignment = $assigngenerator->create_instance([
        'course' => (int)$course->id,
        'name' => 'Report Lab Assignment',
        'duedate' => $assignmentduedate,
        'grade' => 100,
        'gradepass' => 60,
        'submissiondrafts' => 0,
        'assignsubmission_onlinetext_enabled' => 1,
        'assignfeedback_comments_enabled' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ], [
        'section' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ]);

    /** @var mod_quiz_generator $quizgenerator */
    $quizgenerator = $generator->get_plugin_generator('mod_quiz');
    $quiz = $quizgenerator->create_instance([
        'course' => (int)$course->id,
        'name' => 'Report Lab Quiz',
        'grade' => 100,
        'gradepass' => 60,
        'questionsperpage' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ], [
        'section' => 1,
        'completion' => COMPLETION_TRACKING_MANUAL,
    ]);

    $quizcontext = context_module::instance((int)$quiz->cmid);
    $categorygenerator = $generator->get_plugin_generator('core_question');
    $category = $categorygenerator->create_question_category([
        'contextid' => $quizcontext->id,
        'name' => 'Report Lab Quiz Questions',
    ]);

    $questions = [];
    for ($index = 1; $index <= 5; $index++) {
        $question = create_truefalse_question(
            (int)$category->id,
            'Report Lab Q' . $index,
            'Report lab question #' . $index . '. The answer is true.'
        );
        quiz_add_quiz_question((int)$question->id, $quiz, 0, 1);
        $questions[] = [
            'id' => (int)$question->id,
            'name' => (string)$question->name,
            'slot' => $index,
        ];
    }
    \mod_quiz\quiz_settings::create((int)$quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();

    $browserusers = list_tool_generator_users((int)$course->id, 10);
    if (count($browserusers) < 10) {
        cli_error('Expected at least 10 generated learners in the course.');
    }

    $submitters = array_slice($browserusers, 0, 4);
    $graders = array_slice($browserusers, 0, 2);
    $forumauthors = array_slice($browserusers, 0, 3);
    $quizusers = array_slice($browserusers, 0, 5);

    $forumtimes = [
        time() - 3600,
        time() - 3300,
        time() - 3000,
    ];

    $discussion = $forumgenerator->create_discussion([
        'course' => (int)$course->id,
        'forum' => (int)$forum->id,
        'userid' => (int)$forumauthors[0]['id'],
        'name' => 'Report lab discussion',
        'subject' => 'Report lab discussion',
        'message' => '<p>Seeded discussion for forum engagement reporting.</p>',
        'timecreated' => $forumtimes[0],
        'timemodified' => $forumtimes[0],
    ]);
    $discussionrecord = $DB->get_record('forum_discussions', ['id' => (int)$discussion->id], '*', MUST_EXIST);
    $forumgenerator->create_post([
        'discussion' => (int)$discussionrecord->id,
        'parent' => (int)$discussionrecord->firstpost,
        'userid' => (int)$forumauthors[1]['id'],
        'subject' => 'Report lab reply one',
        'message' => '<p>Reply one for forum engagement.</p>',
        'created' => $forumtimes[1],
        'modified' => $forumtimes[1],
    ]);
    $forumgenerator->create_post([
        'discussion' => (int)$discussionrecord->id,
        'parent' => (int)$discussionrecord->firstpost,
        'userid' => (int)$forumauthors[2]['id'],
        'subject' => 'Report lab reply two',
        'message' => '<p>Reply two for forum engagement.</p>',
        'created' => $forumtimes[2],
        'modified' => $forumtimes[2],
    ]);

    $assignmentsubmissiontimes = [
        time() - 2700,
        time() - 2400,
        time() - 2100,
        time() - 1800,
    ];

    with_debug_suppressed(static function() use ($assigngenerator, $submitters, $assignment, $assignmentsubmissiontimes): void {
        foreach ($submitters as $index => $submitter) {
            $assigngenerator->create_submission([
                'userid' => (int)$submitter['id'],
                'cmid' => (int)$assignment->cmid,
                'status' => 'submitted',
                'timemodified' => $assignmentsubmissiontimes[$index],
                'onlinetext' => 'Report lab submission by ' . $submitter['username'],
                'assignsubmission_onlinetext_enabled' => 1,
            ]);
        }
    });

    $assignmentcm = get_coursemodule_from_instance('assign', (int)$assignment->id, (int)$course->id, false, MUST_EXIST);
    $assignmentcontext = context_module::instance((int)$assignmentcm->id);
    $assigninstance = new assign($assignmentcontext, $assignmentcm, $course);

    $gradevalues = ['85.0', '42.0'];
    with_debug_suppressed(static function() use ($graders, $gradevalues, $assigninstance): void {
        foreach ($graders as $index => $grader) {
            $gradedata = new stdClass();
            $gradedata->grade = $gradevalues[$index];
            $gradedata->attemptnumber = 1;
            $gradedata->assignfeedbackcomments_editor = [
                'text' => '',
                'format' => FORMAT_HTML,
            ];
            $assigninstance->save_grade((int)$grader['id'], $gradedata);
        }
    });

    $responsetrue = get_string('true', 'qtype_truefalse');
    $responsefalse = get_string('false', 'qtype_truefalse');
    $responsepatterns = [
        [$responsetrue, $responsetrue, $responsetrue, $responsetrue, $responsetrue],
        [$responsetrue, $responsetrue, $responsefalse, $responsetrue, $responsefalse],
        [$responsefalse, $responsetrue, $responsefalse, $responsetrue, $responsetrue],
        [$responsefalse, $responsefalse, $responsefalse, $responsetrue, $responsefalse],
        [$responsetrue, $responsefalse, $responsetrue, $responsefalse, $responsetrue],
    ];

    $completion = new completion_info($course);
    $pagecm = get_coursemodule_from_instance('page', (int)$page->id, (int)$course->id, false, MUST_EXIST);
    $forumcm = get_coursemodule_from_instance('forum', (int)$forum->id, (int)$course->id, false, MUST_EXIST);
    $quizcm = get_coursemodule_from_instance('quiz', (int)$quiz->id, (int)$course->id, false, MUST_EXIST);

    foreach (array_slice($browserusers, 0, 8) as $user) {
        $completion->update_state($pagecm, COMPLETION_COMPLETE, (int)$user['id'], true);
    }
    foreach ($submitters as $user) {
        $completion->update_state($assignmentcm, COMPLETION_COMPLETE, (int)$user['id'], true);
    }
    foreach ($forumauthors as $user) {
        $completion->update_state($forumcm, COMPLETION_COMPLETE, (int)$user['id'], true);
    }
    foreach ($quizusers as $user) {
        $completion->update_state($quizcm, COMPLETION_COMPLETE, (int)$user['id'], true);
    }

    $jmeterartifacts = [];
    if ($exportdir !== '') {
        ensure_directory($exportdir);
        $plansize = tool_generator_testplan_backend::size_for_name($size);
        $usersfile = tool_generator_testplan_backend::create_users_file((int)$course->id, true, $plansize);
        $testplanfile = tool_generator_testplan_backend::create_testplan_file((int)$course->id, $plansize);

        $jmxpath = rtrim($exportdir, '/') . '/' . $testplanfile->get_filename();
        $csvpath = rtrim($exportdir, '/') . '/' . $usersfile->get_filename();
        $testplanfile->copy_content_to($jmxpath);
        $usersfile->copy_content_to($csvpath);

        $jmeterartifacts = [
            'jmx' => $jmxpath,
            'users_csv' => $csvpath,
            'jmx_filename' => $testplanfile->get_filename(),
            'users_filename' => $usersfile->get_filename(),
        ];
    }

    return [
        'site_url' => rtrim((string)$CFG->wwwroot, '/'),
        'course' => [
            'id' => (int)$course->id,
            'shortname' => (string)$course->shortname,
            'fullname' => (string)$course->fullname,
            'url' => course_get_url((int)$course->id)->out(false),
        ],
        'special_modules' => [
            'page' => module_manifest('page', $page, 'Report Lab Page'),
            'forum' => module_manifest('forum', $forum, 'Report Lab Forum'),
            'assignment' => module_manifest('assign', $assignment, 'Report Lab Assignment'),
            'quiz' => module_manifest('quiz', $quiz, 'Report Lab Quiz'),
        ],
        'questions' => $questions,
        'actors' => [
            'browser_users' => $browserusers,
            'assignment_submitters' => $submitters,
            'assignment_graded' => $graders,
            'forum_authors' => $forumauthors,
            'quiz_attempt_users' => $quizusers,
        ],
        'quiz_response_patterns' => array_map(static function(array $quizuser, array $responses): array {
            return [
                'username' => (string)$quizuser['username'],
                'responses' => array_values($responses),
            ];
        }, $quizusers, $responsepatterns),
        'pruned_generated_assignments' => $prunedassignments,
        'jmeter_artifacts' => $jmeterartifacts,
    ];
}

function get_lab_course(string $shortname): stdClass {
    global $DB;

    $course = $DB->get_record('course', ['shortname' => $shortname], '*', IGNORE_MISSING);
    if (!$course) {
        cli_error('Course not found: ' . $shortname);
    }
    return $course;
}

function prune_generated_assignments(int $courseid): int {
    global $DB, $CFG;

    require_once($CFG->dirroot . '/course/lib.php');

    if (!$DB->record_exists('modules', ['name' => 'assign'])) {
        return 0;
    }

    $moduleid = (int)$DB->get_field('modules', 'id', ['name' => 'assign'], MUST_EXIST);
    $cms = $DB->get_records('course_modules', ['course' => $courseid, 'module' => $moduleid], 'id ASC', 'id');
    $deleted = 0;
    ob_start();
    foreach ($cms as $cm) {
        course_delete_module((int)$cm->id);
        $deleted++;
    }
    ob_end_clean();

    rebuild_course_cache($courseid, true);
    return $deleted;
}

function list_tool_generator_users(int $courseid, int $limit): array {
    global $DB;

    $sql = "
        SELECT DISTINCT
            u.id,
            u.username,
            COALESCE(u.firstname, '') AS firstname,
            COALESCE(u.lastname, '') AS lastname,
            COALESCE(u.email, '') AS email
        FROM {enrol} e
        JOIN {user_enrolments} ue ON ue.enrolid = e.id AND ue.status = 0
        JOIN {user} u ON u.id = ue.userid
        WHERE e.courseid = ?
          AND e.status = 0
          AND u.deleted = 0
          AND u.suspended = 0
          AND " . $DB->sql_like('u.username', '?') . "
        ORDER BY u.username ASC
    ";

    $records = $DB->get_records_sql($sql, [$courseid, 'tool_generator_%'], 0, $limit);
    $users = [];
    foreach ($records as $record) {
        $users[] = [
            'id' => (int)$record->id,
            'username' => trim((string)$record->username),
            'name' => trim($record->firstname . ' ' . $record->lastname),
            'email' => trim((string)$record->email),
        ];
    }

    return $users;
}

function module_manifest(string $modname, stdClass $module, string $label): array {
    global $CFG;

    return [
        'name' => $label,
        'instance_id' => (int)$module->id,
        'cmid' => (int)$module->cmid,
        'url' => rtrim((string)$CFG->wwwroot, '/') . '/mod/' . $modname . '/view.php?id=' . (int)$module->cmid,
    ];
}

function create_truefalse_question(int $categoryid, string $name, string $questiontext): stdClass {
    $qtype = question_bank::get_qtype('truefalse');

    $question = new stdClass();
    $question->qtype = 'truefalse';
    $question->createdby = 0;
    $question->idnumber = null;
    $question->status = \core_question\local\bank\question_version_status::QUESTION_STATUS_READY;

    $form = new stdClass();
    $form->category = (string)$categoryid;
    $form->name = $name;
    $form->questiontext = [
        'format' => FORMAT_HTML,
        'text' => $questiontext,
    ];
    $form->defaultmark = 1;
    $form->generalfeedback = [
        'format' => FORMAT_HTML,
        'text' => 'The correct answer is True.',
    ];
    $form->correctanswer = '1';
    $form->feedbacktrue = [
        'format' => FORMAT_HTML,
        'text' => 'Correct.',
    ];
    $form->feedbackfalse = [
        'format' => FORMAT_HTML,
        'text' => 'Incorrect.',
    ];
    $form->penalty = 1;
    $form->status = \core_question\local\bank\question_version_status::QUESTION_STATUS_READY;
    $form->showstandardinstruction = 1;

    return $qtype->save_question($question, $form);
}

function ensure_directory(string $path): void {
    if ($path === '' || $path === '.' || $path === '/') {
        return;
    }
    if (!is_dir($path) && !mkdir($path, 0777, true) && !is_dir($path)) {
        cli_error('Failed to create directory: ' . $path);
    }
}

function with_debug_suppressed(callable $callback) {
    global $CFG;

    $previousdebug = $CFG->debug ?? 0;
    $previousdisplay = $CFG->debugdisplay ?? 0;

    $CFG->debug = 0;
    $CFG->debugdisplay = 0;

    try {
        return $callback();
    } finally {
        $CFG->debug = $previousdebug;
        $CFG->debugdisplay = $previousdisplay;
    }
}
