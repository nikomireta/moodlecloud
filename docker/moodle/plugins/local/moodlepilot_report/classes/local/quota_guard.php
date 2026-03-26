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

use core\event\user_created;
use core_files\hook\before_file_created;
use core_user\hook\before_user_updated;

class quota_guard {
    /** @var ?array<string, mixed> */
    private static ?array $quotastate = null;
    private static bool $quotastateloaded = false;

    public static function enforce_before_file_created(before_file_created $hook): void {
        $filerecord = $hook->get_filerecord();
        if (($filerecord->filename ?? '') === '.') {
            return;
        }

        $state = self::load_quota_state();
        if ($state === null) {
            return;
        }

        $limit = max(0, (int)($state['storage_bytes_limit'] ?? 0));
        if ($limit <= 0) {
            return;
        }

        $pendingbytes = self::pending_file_size($hook);
        if ($pendingbytes <= 0) {
            return;
        }

        $usedbytes = max(0, (int)($state['storage_bytes_used'] ?? 0));
        $projectedbytes = $usedbytes + $pendingbytes;
        if ($projectedbytes > $limit) {
            throw new \moodle_exception('quota:error_storage_limit_reached', 'local_moodlepilot_report', '', (object) [
                'limit' => display_size($limit),
                'used' => display_size($usedbytes),
                'upload' => display_size($pendingbytes),
                'projected' => display_size($projectedbytes),
            ]);
        }

        self::reserve_storage_bytes($pendingbytes);
    }

    public static function enforce_before_user_updated(before_user_updated $hook): void {
        $state = self::load_quota_state();
        if ($state === null) {
            return;
        }

        $limit = max(0, (int)($state['users_active_limit'] ?? 0));
        if ($limit <= 0) {
            return;
        }

        $currentuser = $hook->currentuserdata;
        $futureuser = self::merge_user_state($hook->currentuserdata, $hook->user);

        if (self::counts_as_active_user($currentuser) || !self::counts_as_active_user($futureuser)) {
            return;
        }

        $usedslots = max(0, (int)($state['users_active_count'] ?? 0));
        if (($usedslots + 1) > $limit) {
            throw new \moodle_exception('quota:error_users_limit_reached', 'local_moodlepilot_report', '', (object) [
                'limit' => $limit,
                'used' => $usedslots,
            ]);
        }

        self::reserve_user_slot();
    }

    public static function enforce_after_user_created(user_created $event): void {
        global $CFG, $DB;

        $state = self::load_quota_state(true);
        if ($state === null) {
            return;
        }

        $limit = max(0, (int)($state['users_active_limit'] ?? 0));
        if ($limit <= 0) {
            return;
        }

        $user = $DB->get_record('user', ['id' => (int)$event->objectid]);
        if (!$user || !self::counts_as_active_user($user)) {
            return;
        }

        $usedslots = max(0, (int)($state['users_active_count'] ?? 0));
        if ($usedslots <= $limit) {
            return;
        }

        require_once($CFG->dirroot . '/user/lib.php');
        user_update_user((object) [
            'id' => (int)$user->id,
            'suspended' => 1,
        ], false, true);

        if (self::$quotastate !== null) {
            self::$quotastate['users_active_count'] = max(0, $usedslots - 1);
        }
    }

    /**
     * @return ?array<string, mixed>
     */
    public static function current_quota_state(bool $refresh = false): ?array {
        return self::load_quota_state($refresh);
    }

    private static function pending_file_size(before_file_created $hook): int {
        if ($hook->has_filepath()) {
            $filepath = (string)$hook->get_filepath();
            $filesize = @filesize($filepath);
            if ($filesize === false) {
                return 0;
            }
            return max(0, (int)$filesize);
        }

        if ($hook->has_filecontent()) {
            return max(0, strlen((string)$hook->get_filecontent()));
        }

        return 0;
    }

    private static function merge_user_state(\stdClass $currentuser, \stdClass $incominguser): \stdClass {
        $merged = clone $currentuser;
        foreach (get_object_vars($incominguser) as $key => $value) {
            $merged->{$key} = $value;
        }
        return $merged;
    }

    private static function counts_as_active_user(\stdClass $user): bool {
        $username = trim(\core_text::strtolower((string)($user->username ?? '')));
        if ($username === '' || $username === 'guest') {
            return false;
        }
        if (!empty($user->id) && (int)$user->id === self::admin_user_id()) {
            return false;
        }
        if (!empty($user->deleted) || !empty($user->suspended)) {
            return false;
        }
        return true;
    }

    private static function admin_user_id(): int {
        static $adminuserid = null;

        if ($adminuserid !== null) {
            return $adminuserid;
        }

        $adminuser = get_admin();
        $adminuserid = $adminuser ? (int)$adminuser->id : 0;
        return $adminuserid;
    }

    private static function reserve_storage_bytes(int $bytes): void {
        if (self::$quotastate === null || $bytes <= 0) {
            return;
        }
        self::$quotastate['storage_bytes_used'] = max(0, (int)(self::$quotastate['storage_bytes_used'] ?? 0)) + $bytes;
    }

    private static function reserve_user_slot(): void {
        if (self::$quotastate === null) {
            return;
        }
        self::$quotastate['users_active_count'] = max(0, (int)(self::$quotastate['users_active_count'] ?? 0)) + 1;
    }

    /**
     * @return ?array<string, mixed>
     */
    private static function load_quota_state(bool $refresh = false): ?array {
        global $CFG;

        if ($refresh) {
            self::$quotastate = null;
            self::$quotastateloaded = false;
        }

        if (self::$quotastateloaded) {
            return self::$quotastate;
        }
        self::$quotastateloaded = true;

        if (!bootstrap_config::plugin_enabled() || !bootstrap_config::is_registered()) {
            return null;
        }

        $quotaendpoint = bootstrap_config::quota_endpoint();
        $ingesttoken = bootstrap_config::ingest_token();
        if (trim($quotaendpoint) === '' || trim($ingesttoken) === '') {
            return null;
        }

        $response = internal_api_client::get_json(
            $quotaendpoint,
            ['Authorization' => 'Bearer ' . $ingesttoken]
        );
        $statuscode = (int)$response['status_code'];
        $decoded = is_array($response['decoded']) ? $response['decoded'] : null;
        if ($statuscode < 200 || $statuscode >= 300 || !is_array($decoded)) {
            return null;
        }

        self::$quotastate = [
            'site_id' => trim((string)($decoded['site_id'] ?? '')),
            'plan_code' => trim((string)($decoded['plan_code'] ?? '')),
            'users_active_limit' => max(0, (int)($decoded['users_active_limit'] ?? 0)),
            'storage_bytes_limit' => max(0, (int)($decoded['storage_bytes_limit'] ?? 0)),
            'users_active_count' => max(0, (int)($decoded['users_active_count'] ?? 0)),
            'files_bytes_used' => max(0, (int)($decoded['files_bytes_used'] ?? 0)),
            'database_bytes_used' => max(0, (int)($decoded['database_bytes_used'] ?? 0)),
            'storage_bytes_used' => max(0, (int)($decoded['storage_bytes_used'] ?? 0)),
            'warning_level' => trim((string)($decoded['warning_level'] ?? 'normal')),
            'over_limit' => !empty($decoded['over_limit']),
            'measured_at' => trim((string)($decoded['measured_at'] ?? '')),
            'usage_source' => trim((string)($decoded['usage_source'] ?? '')),
            'last_error' => trim((string)($decoded['last_error'] ?? '')),
        ];

        return self::$quotastate;
    }
}
