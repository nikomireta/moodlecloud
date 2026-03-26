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

class bootstrap_config {
    private static function plugin_config_value(string $name): string {
        return trim((string)get_config('local_moodlepilot_report', $name));
    }

    public static function plugin_enabled(): bool {
        $value = get_config('local_moodlepilot_report', 'enabled');
        if ($value === false || $value === null || $value === '') {
            return true;
        }
        return !in_array(strtolower(trim((string)$value)), ['0', 'false', 'off', 'no'], true);
    }

    public static function provisioned_site_id(): string {
        global $CFG;

        return trim((string)($CFG->moodlepilot_site_id ?? ''));
    }

    public static function manual_site_id(): string {
        return self::plugin_config_value('manual_site_id');
    }

    public static function site_id(): string {
        return self::first_non_empty(self::provisioned_site_id(), self::manual_site_id());
    }

    public static function auto_authorize_enabled(): bool {
        global $CFG;

        $value = strtolower(trim((string)($CFG->moodlepilot_report_auto_authorize ?? '')));
        return !in_array($value, ['0', 'false', 'off', 'no'], true);
    }

    public static function provisioned_api_base_url(): string {
        global $CFG;

        return trim((string)($CFG->moodlepilot_api_base_url ?? ''));
    }

    public static function manual_api_base_url(): string {
        return self::plugin_config_value('manual_api_base_url');
    }

    public static function api_base_url(): string {
        return self::first_non_empty(self::provisioned_api_base_url(), self::manual_api_base_url());
    }

    public static function bootstrap_token_present(): bool {
        return self::bootstrap_token() !== '';
    }

    public static function bootstrap_token(): string {
        global $CFG;

        return trim((string)($CFG->moodlepilot_report_bootstrap_token ?? ''));
    }

    public static function manual_registration_token(): string {
        return self::plugin_config_value('manual_registration_token');
    }

    public static function manual_reconnect_requested(): bool {
        $value = strtolower(self::plugin_config_value('manual_force_reconnect'));
        return in_array($value, ['1', 'true', 'on', 'yes'], true);
    }

    public static function bootstrap_endpoint(): string {
        if (self::api_base_url() === '') {
            return '';
        }
        return rtrim(self::api_base_url(), '/') . '/v1/internal/moodle/report/bootstrap';
    }

    public static function connect_endpoint(): string {
        if (self::api_base_url() === '') {
            return '';
        }
        return rtrim(self::api_base_url(), '/') . '/v1/internal/moodle/report/connect';
    }

    public static function quota_endpoint(): string {
        if (self::api_base_url() === '') {
            return '';
        }
        return rtrim(self::api_base_url(), '/') . '/v1/internal/moodle/report/quota';
    }

    public static function plugin_version(): string {
        global $CFG;

        $release = '';
        $plugin = new \stdClass();
        require($CFG->dirroot . '/local/moodlepilot_report/version.php');
        if (isset($plugin->release)) {
            $release = trim((string)$plugin->release);
        }
        return $release;
    }

    public static function moodle_version(): string {
        global $CFG;

        if (!empty($CFG->release)) {
            return trim((string)$CFG->release);
        }

        $release = '';
        $branch = '';
        require($CFG->dirroot . '/version.php');
        if (trim((string)$release) !== '') {
            return trim((string)$release);
        }
        return trim((string)$branch);
    }

    public static function capabilities(): array {
        return [
            'summary_metrics_v1',
            'daily_trend_v1',
            'recent_activity_v1',
            'course_completion_v1',
            'assignment_submission_detail_v1',
            'forum_engagement_summary_v1',
            'grade_recap_v1',
            'gradebook_detail_v1',
            'user_activity_v1',
            'user_status_v1',
            'at_risk_users_v1',
            'activity_stats_summary_v1',
            'activity_completion_detail_v1',
            'quiz_activity_detail_v1',
            'quiz_question_analysis_v1',
            'tracking_events_v1',
            'browser_tracking_v1',
            'tracking_rollup_v1',
            'sync_journal_v1',
            'local_reports_v1',
        ];
    }

    public static function registration_state(): string {
        $state = trim((string)get_config('local_moodlepilot_report', 'registration_state'));
        if ($state !== '') {
            return $state;
        }
        if (self::is_registered()) {
            return 'registered';
        }
        if (self::connection_mode() !== '') {
            return 'pending';
        }
        if (self::manual_connect_state() === 'partial') {
            return 'manual_incomplete';
        }
        if (self::bootstrap_state() !== 'ready' && self::bootstrap_state() !== 'missing_site_id') {
            return 'bootstrap_incomplete';
        }
        return 'not_connected';
    }

    public static function is_registered(): bool {
        return self::ingest_token() !== '';
    }

    public static function ingest_token(): string {
        return trim((string)get_config('local_moodlepilot_report', 'ingest_token'));
    }

    public static function ingest_url(): string {
        return trim((string)get_config('local_moodlepilot_report', 'ingest_url'));
    }

    public static function registered_at(): string {
        return trim((string)get_config('local_moodlepilot_report', 'registered_at'));
    }

    public static function last_bootstrap_error(): string {
        return trim((string)get_config('local_moodlepilot_report', 'last_bootstrap_error'));
    }

    public static function last_report_push_at(): string {
        return trim((string)get_config('local_moodlepilot_report', 'last_report_push_at'));
    }

    public static function last_tracking_seen_at(): string {
        return trim((string)get_config('local_moodlepilot_report', 'last_tracking_seen_at'));
    }

    public static function last_rollup_at(): string {
        return trim((string)get_config('local_moodlepilot_report', 'last_rollup_at'));
    }

    public static function tracking_mode(): string {
        $configured = trim((string)get_config('local_moodlepilot_report', 'tracking_mode'));
        if ($configured !== '') {
            return $configured;
        }
        return 'browser_heartbeat_v1';
    }

    public static function connection_mode(): string {
        if (self::bootstrap_state() === 'ready') {
            return 'auto';
        }
        if (self::manual_connect_state() === 'ready') {
            return 'manual';
        }
        return '';
    }

    public static function tracking_interval_seconds(): int {
        return 15;
    }

    public static function tracking_inactivity_seconds(): int {
        return 60;
    }

    public static function last_ingest_error(): string {
        return trim((string)get_config('local_moodlepilot_report', 'last_ingest_error'));
    }

    public static function error_message_from_response($decoded, string $rawresponse, int $statuscode): string {
        if (is_array($decoded) && !empty($decoded['error'])) {
            return trim((string)$decoded['error']);
        }
        if (trim($rawresponse) !== '') {
            return trim($rawresponse);
        }
        if ($statuscode > 0) {
            return 'HTTP ' . $statuscode;
        }
        return get_string('connection:error_unknown', 'local_moodlepilot_report');
    }

    public static function bootstrap_state(): string {
        if (self::provisioned_site_id() === '') {
            return 'missing_site_id';
        }
        if (!self::auto_authorize_enabled()) {
            return 'disabled';
        }
        if (self::provisioned_api_base_url() === '' || !self::bootstrap_token_present()) {
            return 'partial';
        }
        return 'ready';
    }

    public static function manual_connect_state(): string {
        $siteid = self::manual_site_id();
        $apibaseurl = self::manual_api_base_url();
        $token = self::manual_registration_token();

        if ($siteid === '' && $apibaseurl === '' && $token === '') {
            return 'not_configured';
        }
        if ($siteid === '' || $apibaseurl === '' || $token === '') {
            return 'partial';
        }
        return 'ready';
    }

    public static function display_value(string $value): string {
        if (trim($value) === '') {
            return get_string('bootstrap:not_configured', 'local_moodlepilot_report');
        }
        return $value;
    }

    private static function first_non_empty(string ...$values): string {
        foreach ($values as $value) {
            $value = trim($value);
            if ($value !== '') {
                return $value;
            }
        }
        return '';
    }
}
