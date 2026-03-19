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
use local_moodlepilot_report\local\analytics_repository;
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
        $snapshots = report_snapshot_builder::build_supported_snapshots();
        $lastreceivedat = '';

        foreach ($snapshots as $snapshot) {
            $syncid = 0;
            try {
                $snapshotkey = trim((string)($snapshot['snapshot_key'] ?? 'reports_summary_v1'));
                $periodkey = trim((string)($snapshot['period_key'] ?? 'last_7_days'));
                $syncid = analytics_repository::start_sync('report_ingest', $snapshotkey, $periodkey);

                $payload = [
                    'site_id' => bootstrap_config::site_id(),
                    'site_url' => rtrim((string)$CFG->wwwroot, '/'),
                    'snapshot_key' => $snapshotkey,
                    'period_key' => $periodkey,
                    'period_start' => trim((string)($snapshot['period_start'] ?? '')),
                    'period_end' => trim((string)($snapshot['period_end'] ?? '')),
                    'generated_at' => gmdate(\DateTimeInterface::ATOM),
                    'plugin_version' => bootstrap_config::plugin_version(),
                    'moodle_version' => bootstrap_config::moodle_version(),
                    'capabilities' => bootstrap_config::capabilities(),
                    'tracking_mode' => bootstrap_config::tracking_mode(),
                    'tracking_last_seen_at' => bootstrap_config::last_tracking_seen_at(),
                    'payload' => $snapshot['payload'] ?? new \stdClass(),
                ];

                $json = json_encode($payload);
                if ($json === false) {
                    $this->store_error(get_string('report:error_invalid_payload', 'local_moodlepilot_report'), $syncid);
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
                    $this->store_error(bootstrap_config::error_message_from_response($decoded, (string)$response, $statuscode), $syncid);
                    return;
                }

                $receivedat = trim((string)($decoded['received_at'] ?? ''));
                if ($receivedat === '') {
                    $receivedat = gmdate(\DateTimeInterface::ATOM);
                }

                $snapshotpayload = is_array($snapshot['payload'] ?? null) ? $snapshot['payload'] : [];
                analytics_repository::complete_sync(
                    $syncid,
                    analytics_repository::count_snapshot_items($snapshotpayload),
                    hash('sha256', $json)
                );
                $lastreceivedat = $receivedat;
            } catch (\Throwable $exception) {
                $this->store_error($exception->getMessage(), $syncid);
                return;
            }
        }

        if ($lastreceivedat === '') {
            $lastreceivedat = gmdate(\DateTimeInterface::ATOM);
        }

        set_config('last_report_push_at', $lastreceivedat, 'local_moodlepilot_report');
        set_config('last_ingest_error', '', 'local_moodlepilot_report');
        mtrace('[local_moodlepilot_report] report snapshot ingest completed.');
    }

    private function store_error(string $message, int $syncid = 0): void {
        $message = trim($message);
        if ($message === '') {
            $message = get_string('report:error_unknown', 'local_moodlepilot_report');
        }

        analytics_repository::fail_sync($syncid, $message);
        set_config('last_ingest_error', $message, 'local_moodlepilot_report');
        mtrace('[local_moodlepilot_report] report snapshot ingest failed: ' . $message);
    }
}
