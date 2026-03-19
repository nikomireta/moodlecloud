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
use local_moodlepilot_report\local\tracking_repository;

class tracking_rollup_task extends scheduled_task {
    public function get_name(): string {
        return get_string('task:tracking_rollup', 'local_moodlepilot_report');
    }

    public function execute(): void {
        if (!bootstrap_config::plugin_enabled()) {
            return;
        }

        $processed = tracking_repository::process_pending_detail_rows();
        mtrace('[local_moodlepilot_report] tracking rollup processed ' . $processed . ' detail rows.');
    }
}
