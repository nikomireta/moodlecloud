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

class internal_api_client {
    /**
     * @param array<string, string> $headers
     * @return array{status_code:int, raw_body:string, decoded:mixed}
     */
    public static function post_json(string $url, array $payload, array $headers = [], int $timeout = 20): array {
        $json = json_encode($payload);
        if ($json === false) {
            return [
                'status_code' => 0,
                'raw_body' => '',
                'decoded' => null,
            ];
        }

        $curl = self::new_curl();
        $response = $curl->post(
            $url,
            $json,
            self::curl_options($headers, $timeout)
        );

        return self::build_response($curl, $response);
    }

    /**
     * @param array<string, string> $headers
     * @return array{status_code:int, raw_body:string, decoded:mixed}
     */
    public static function get_json(string $url, array $headers = [], int $timeout = 20): array {
        $curl = self::new_curl();
        $response = $curl->get(
            $url,
            [],
            self::curl_options($headers, $timeout)
        );

        return self::build_response($curl, $response);
    }

    private static function new_curl(): \curl {
        global $CFG;

        require_once($CFG->libdir . '/filelib.php');

        $options = [
            'securityhelper' => new internal_api_security_helper(bootstrap_config::api_base_url()),
        ];
        if (bootstrap_config::allow_insecure_internal_http()) {
            $options['ignoresecurity'] = true;
        }
        return new \curl($options);
    }

    /**
     * @param array<string, string> $headers
     * @return array<string, mixed>
     */
    private static function curl_options(array $headers, int $timeout): array {
        $httpheaders = [
            'Accept: application/json',
        ];
        foreach ($headers as $name => $value) {
            $httpheaders[] = trim($name) . ': ' . trim($value);
        }

        return [
            'CURLOPT_RETURNTRANSFER' => true,
            'CURLOPT_CONNECTTIMEOUT' => 5,
            'CURLOPT_TIMEOUT' => max(1, $timeout),
            'CURLOPT_HTTPHEADER' => $httpheaders,
        ];
    }

    /**
     * @param mixed $response
     * @return array{status_code:int, raw_body:string, decoded:mixed}
     */
    private static function build_response(\curl $curl, $response): array {
        $info = $curl->get_info();
        return [
            'status_code' => (int)($info['http_code'] ?? 0),
            'raw_body' => (string)$response,
            'decoded' => json_decode((string)$response, true),
        ];
    }
}
