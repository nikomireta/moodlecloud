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

namespace local_moodlepilot_report\task;

defined('MOODLE_INTERNAL') || die();

use core\task\scheduled_task;
use local_moodlepilot_report\local\bootstrap_config;

class bootstrap_registration_task extends scheduled_task {
    public function get_name(): string {
        return get_string('task:bootstrap_registration', 'local_moodlepilot_report');
    }

    public function execute(): void {
        global $CFG;

        if (!bootstrap_config::plugin_enabled()) {
            return;
        }

        $mode = bootstrap_config::connection_mode();
        $forcereconnect = bootstrap_config::manual_reconnect_requested();

        if (bootstrap_config::is_registered() && !$forcereconnect) {
            set_config('registration_state', 'registered', 'local_moodlepilot_report');
            return;
        }

        if ($mode === '') {
            if (bootstrap_config::manual_connect_state() === 'partial') {
                set_config('registration_state', 'manual_incomplete', 'local_moodlepilot_report');
            } else if (bootstrap_config::bootstrap_state() !== 'ready' && bootstrap_config::bootstrap_state() !== 'missing_site_id') {
                set_config('registration_state', 'bootstrap_incomplete', 'local_moodlepilot_report');
            } else if (!bootstrap_config::auto_authorize_enabled()) {
                set_config('registration_state', 'disabled', 'local_moodlepilot_report');
            } else {
                set_config('registration_state', 'not_connected', 'local_moodlepilot_report');
            }
            return;
        }

        if ($mode === 'auto' && !bootstrap_config::auto_authorize_enabled()) {
            set_config('registration_state', 'disabled', 'local_moodlepilot_report');
            return;
        }

        require_once($CFG->libdir . '/filelib.php');

        $payload = [
            'site_id' => bootstrap_config::site_id(),
            'site_url' => rtrim((string)$CFG->wwwroot, '/'),
            'plugin_version' => bootstrap_config::plugin_version(),
            'moodle_version' => bootstrap_config::moodle_version(),
            'capabilities' => bootstrap_config::capabilities(),
        ];
        if ($mode === 'auto') {
            $payload['bootstrap_token'] = bootstrap_config::bootstrap_token();
        } else {
            $payload['registration_token'] = bootstrap_config::manual_registration_token();
        }

        $json = json_encode($payload);
        if ($json === false) {
            $this->store_error(get_string('connection:error_invalid_payload', 'local_moodlepilot_report'));
            return;
        }

        $targetendpoint = $mode === 'manual'
            ? bootstrap_config::connect_endpoint()
            : bootstrap_config::bootstrap_endpoint();

        if (trim($targetendpoint) === '') {
            $this->store_error(get_string('connection:error_missing_endpoint', 'local_moodlepilot_report'));
            return;
        }

        // The bootstrap or connect target may use an internal host like
        // host.docker.internal in local environments.
        $curl = new \curl(['ignoresecurity' => true]);
        $response = $curl->post(
            $targetendpoint,
            $json,
            [
                'CURLOPT_RETURNTRANSFER' => true,
                'CURLOPT_CONNECTTIMEOUT' => 5,
                'CURLOPT_TIMEOUT' => 20,
                'CURLOPT_HTTPHEADER' => [
                    'Content-Type: application/json',
                    'Accept: application/json',
                ],
            ]
        );

        $info = $curl->get_info();
        $statuscode = (int)($info['http_code'] ?? 0);
        $decoded = json_decode((string)$response, true);

        if ($statuscode < 200 || $statuscode >= 300 || !is_array($decoded)) {
            $message = bootstrap_config::error_message_from_response($decoded, (string)$response, $statuscode);
            $this->store_error($message);
            return;
        }

        $ingesttoken = trim((string)($decoded['ingest_token'] ?? ''));
        if ($ingesttoken === '') {
            $this->store_error(get_string('connection:error_missing_ingest_token', 'local_moodlepilot_report'));
            return;
        }

        set_config('ingest_token', $ingesttoken, 'local_moodlepilot_report');
        set_config('ingest_url', trim((string)($decoded['ingest_url'] ?? '')), 'local_moodlepilot_report');
        set_config('registered_at', trim((string)($decoded['registered_at'] ?? '')), 'local_moodlepilot_report');
        set_config('registration_state', 'registered', 'local_moodlepilot_report');
        set_config('last_bootstrap_error', '', 'local_moodlepilot_report');
        set_config('last_ingest_error', '', 'local_moodlepilot_report');
        if ($mode === 'manual') {
            set_config('manual_force_reconnect', 0, 'local_moodlepilot_report');
        }
        mtrace('[local_moodlepilot_report] ' . $mode . ' registration completed.');
    }

    private function store_error(string $message): void {
        $message = trim($message);
        if ($message === '') {
            $message = get_string('connection:error_unknown', 'local_moodlepilot_report');
        }

        set_config('registration_state', 'error', 'local_moodlepilot_report');
        set_config('last_bootstrap_error', $message, 'local_moodlepilot_report');
        mtrace('[local_moodlepilot_report] bootstrap registration failed: ' . $message);
    }
}
