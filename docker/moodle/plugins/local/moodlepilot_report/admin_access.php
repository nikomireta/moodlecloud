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
use local_moodlepilot_report\local\internal_api_client;

require_once($CFG->libdir . '/filelib.php');

$token = trim((string)optional_param('t', '', PARAM_RAW_TRIMMED));
$systemcontext = context_system::instance();

$PAGE->set_context($systemcontext);
$PAGE->set_url(new moodle_url('/local/moodlepilot_report/admin_access.php'));
$PAGE->set_pagelayout('login');
$PAGE->set_title(get_string('adminaccess:page_title', 'local_moodlepilot_report'));
$PAGE->set_heading(get_string('adminaccess:page_heading', 'local_moodlepilot_report'));
$PAGE->navbar->add(get_string('adminaccess:page_heading', 'local_moodlepilot_report'));

if (!headers_sent()) {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Referrer-Policy: no-referrer');
}

$render_error = static function(string $message, int $statuscode = 400) use ($OUTPUT): void {
    if (!headers_sent()) {
        http_response_code($statuscode);
    }

    echo $OUTPUT->header();
    echo $OUTPUT->notification(s($message), 'notifyproblem');
    echo html_writer::div(
        html_writer::link(new moodle_url('/'), get_string('adminaccess:return_home', 'local_moodlepilot_report')),
        'mt-3'
    );
    echo $OUTPUT->footer();
    exit;
};

$find_user_by_email = static function(string $email) {
    global $DB;

    $email = trim(core_text::strtolower($email));
    if ($email === '') {
        return null;
    }

    $matches = $DB->get_records_select(
        'user',
        'deleted = 0 AND LOWER(email) = LOWER(?)',
        [$email],
        '',
        'id, username, email, auth, suspended, deleted'
    );
    if (empty($matches)) {
        return null;
    }
    if (count($matches) > 1) {
        throw new moodle_exception('adminaccess:error_ambiguous_email', 'local_moodlepilot_report');
    }

    return reset($matches);
};

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $render_error(get_string('adminaccess:error_post_required', 'local_moodlepilot_report'), 405);
}

if ($token === '') {
    $render_error(get_string('adminaccess:error_missing_token', 'local_moodlepilot_report'));
}

$siteid = bootstrap_config::site_id();
$bootstraptoken = bootstrap_config::bootstrap_token();
$redeemendpoint = bootstrap_config::admin_access_redeem_endpoint();
if ($siteid === '' || $bootstraptoken === '' || $redeemendpoint === '') {
    $render_error(get_string('adminaccess:error_unavailable', 'local_moodlepilot_report'), 503);
}

$payload = [
    'site_id' => $siteid,
    'access_token' => $token,
];
if ($bootstraptoken !== '') {
    $payload['bootstrap_token'] = $bootstraptoken;
}
$headers = ['Content-Type' => 'application/json'];
$ingesttoken = bootstrap_config::ingest_token();
if ($ingesttoken !== '') {
    $headers['Authorization'] = 'Bearer ' . $ingesttoken;
}

$response = internal_api_client::post_json($redeemendpoint, $payload, $headers);
$statuscode = (int)$response['status_code'];
$decoded = is_array($response['decoded']) ? $response['decoded'] : null;
$rawbody = (string)$response['raw_body'];

if ($statuscode < 200 || $statuscode >= 300 || !is_array($decoded)) {
    $message = bootstrap_config::error_message_from_response($decoded, $rawbody, $statuscode);
    $render_error($message, $statuscode > 0 ? $statuscode : 500);
}

$username = trim((string)($decoded['username'] ?? ''));
$email = trim((string)($decoded['email'] ?? ''));
$redirectpath = trim((string)($decoded['redirect_path'] ?? '/login/change_password.php'));
if ($redirectpath === '' || !str_starts_with($redirectpath, '/')) {
    $redirectpath = '/login/change_password.php';
}

$user = null;
if ($username !== '') {
    $user = \core\user::get_user_by_username($username, '*', null, IGNORE_MISSING);
}
if (!$user && $email !== '') {
    try {
        $user = $find_user_by_email($email);
    } catch (moodle_exception $exception) {
        $render_error($exception->getMessage(), 409);
    }
}
if (!$user) {
    $render_error(get_string('adminaccess:error_user_not_found', 'local_moodlepilot_report'), 404);
}

try {
    \core\user::require_active_user($user, true, true);
} catch (moodle_exception $exception) {
    $render_error(get_string('adminaccess:error_user_not_found', 'local_moodlepilot_report'), 409);
}

$completeuser = get_complete_user_data('id', $user->id);
if (!$completeuser) {
    $render_error(get_string('adminaccess:error_user_not_found', 'local_moodlepilot_report'), 404);
}

$authplugin = get_auth_plugin($completeuser->auth);
if (
    $redirectpath === '/login/change_password.php' &&
    method_exists($authplugin, 'can_change_password') &&
    !$authplugin->can_change_password()
) {
    $redirectpath = '/' . trim((string)$CFG->admin, '/');
}

if (isloggedin() && !isguestuser() && (int)$USER->id !== (int)$completeuser->id) {
    require_logout();
}

if (!isloggedin() || isguestuser() || (int)$USER->id !== (int)$completeuser->id) {
    complete_user_login($completeuser);
    \core\session\manager::apply_concurrent_login_limit($completeuser->id, session_id());
}

\core\notification::add(
    get_string('adminaccess:success_notice', 'local_moodlepilot_report'),
    \core\output\notification::NOTIFY_INFO
);

redirect(new moodle_url($redirectpath));
