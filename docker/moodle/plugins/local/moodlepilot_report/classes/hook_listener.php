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

namespace local_moodlepilot_report;

defined('MOODLE_INTERNAL') || die();

use core_files\hook\before_file_created;
use core_user\hook\before_user_updated;
use local_moodlepilot_report\local\quota_guard;

class hook_listener {
    public static function before_file_created(before_file_created $hook): void {
        quota_guard::enforce_before_file_created($hook);
    }

    public static function before_user_updated(before_user_updated $hook): void {
        quota_guard::enforce_before_user_updated($hook);
    }
}
