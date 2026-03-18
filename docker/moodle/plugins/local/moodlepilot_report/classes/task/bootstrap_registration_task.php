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

        if (bootstrap_config::is_registered()) {
            set_config('registration_state', 'registered', 'local_moodlepilot_report');
            return;
        }

        if (!bootstrap_config::auto_authorize_enabled()) {
            set_config('registration_state', 'disabled', 'local_moodlepilot_report');
            return;
        }

        if (bootstrap_config::bootstrap_state() !== 'ready') {
            set_config('registration_state', 'bootstrap_incomplete', 'local_moodlepilot_report');
            return;
        }

        require_once($CFG->libdir . '/filelib.php');

        $payload = [
            'site_id' => bootstrap_config::site_id(),
            'bootstrap_token' => bootstrap_config::bootstrap_token(),
            'site_url' => rtrim((string)$CFG->wwwroot, '/'),
            'plugin_version' => bootstrap_config::plugin_version(),
            'moodle_version' => bootstrap_config::moodle_version(),
            'capabilities' => bootstrap_config::capabilities(),
        ];

        $json = json_encode($payload);
        if ($json === false) {
            $this->store_error(get_string('connection:error_invalid_payload', 'local_moodlepilot_report'));
            return;
        }

        // The bootstrap target is provisioned by Moodlepilot itself and may use
        // an internal host like host.docker.internal in local environments.
        $curl = new \curl(['ignoresecurity' => true]);
        $response = $curl->post(
            bootstrap_config::bootstrap_endpoint(),
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
        mtrace('[local_moodlepilot_report] bootstrap registration completed.');
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
