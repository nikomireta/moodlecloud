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
use local_moodlepilot_report\local\report_snapshot_builder;

class report_snapshot_ingest_task extends scheduled_task {
    public function get_name(): string {
        return get_string('task:report_snapshot_ingest', 'local_moodlepilot_report');
    }

    public function execute(): void {
        global $CFG;

        if (!bootstrap_config::plugin_enabled()) {
            return;
        }

        if (!bootstrap_config::is_registered()) {
            return;
        }

        $ingesturl = bootstrap_config::ingest_url();
        $ingesttoken = bootstrap_config::ingest_token();
        if ($ingesturl === '' || $ingesttoken === '') {
            return;
        }

        require_once($CFG->libdir . '/filelib.php');

        $snapshot = report_snapshot_builder::build_last_7_days();
        $payload = [
            'site_id' => bootstrap_config::site_id(),
            'snapshot_key' => trim((string)($snapshot['snapshot_key'] ?? 'reports_summary_v1')),
            'period_key' => trim((string)($snapshot['period_key'] ?? 'last_7_days')),
            'period_start' => trim((string)($snapshot['period_start'] ?? '')),
            'period_end' => trim((string)($snapshot['period_end'] ?? '')),
            'generated_at' => gmdate(\DateTimeInterface::ATOM),
            'plugin_version' => bootstrap_config::plugin_version(),
            'moodle_version' => bootstrap_config::moodle_version(),
            'payload' => $snapshot['payload'] ?? new \stdClass(),
        ];

        $json = json_encode($payload);
        if ($json === false) {
            $this->store_error(get_string('report:error_invalid_payload', 'local_moodlepilot_report'));
            return;
        }

        $curl = new \curl(['ignoresecurity' => true]);
        $response = $curl->post(
            $ingesturl,
            $json,
            [
                'CURLOPT_RETURNTRANSFER' => true,
                'CURLOPT_CONNECTTIMEOUT' => 5,
                'CURLOPT_TIMEOUT' => 30,
                'CURLOPT_HTTPHEADER' => [
                    'Content-Type: application/json',
                    'Accept: application/json',
                    'Authorization: Bearer ' . $ingesttoken,
                ],
            ]
        );

        $info = $curl->get_info();
        $statuscode = (int)($info['http_code'] ?? 0);
        $decoded = json_decode((string)$response, true);

        if ($statuscode < 200 || $statuscode >= 300 || !is_array($decoded)) {
            $this->store_error(bootstrap_config::error_message_from_response($decoded, (string)$response, $statuscode));
            return;
        }

        $receivedat = trim((string)($decoded['received_at'] ?? ''));
        if ($receivedat === '') {
            $receivedat = gmdate(\DateTimeInterface::ATOM);
        }

        set_config('last_report_push_at', $receivedat, 'local_moodlepilot_report');
        set_config('last_ingest_error', '', 'local_moodlepilot_report');
        mtrace('[local_moodlepilot_report] report snapshot ingest completed.');
    }

    private function store_error(string $message): void {
        $message = trim($message);
        if ($message === '') {
            $message = get_string('report:error_unknown', 'local_moodlepilot_report');
        }

        set_config('last_ingest_error', $message, 'local_moodlepilot_report');
        mtrace('[local_moodlepilot_report] report snapshot ingest failed: ' . $message);
    }
}
