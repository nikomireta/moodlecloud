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

use core\files\curl_security_helper;
use core\ip_utils;

defined('MOODLE_INTERNAL') || die();

/**
 * Allow the plugin's provisioned Moodlepilot internal API base URL even when it
 * uses a private/local address such as host.docker.internal for local runtime wiring.
 *
 * All other URLs keep using Moodle's default curl security checks.
 */
class internal_api_security_helper extends curl_security_helper {
    /** @var string */
    private $allowedbaseurl;

    /**
     * @param string $allowedbaseurl Provisioned Moodlepilot API base URL.
     */
    public function __construct(string $allowedbaseurl) {
        $this->allowedbaseurl = rtrim(trim($allowedbaseurl), '/');
    }

    /**
     * @param string $urlstring
     * @param int|null $notused
     * @return bool
     */
    public function url_is_blocked($urlstring, $notused = null) {
        if ($notused !== null) {
            debugging('The $maxredirects parameter of curl_security_helper::url_is_blocked() has been dropped!', DEBUG_DEVELOPER);
        }

        $allowedtarget = $this->match_allowed_internal_url((string)$urlstring);
        if ($allowedtarget !== null) {
            $ips = $this->resolve_allowed_ips($allowedtarget['host']);
            if (empty($ips)) {
                return true;
            }

            $this->host = $allowedtarget['host'];
            $this->allowedport = $allowedtarget['port'];
            $this->allowedips = $ips;
            return false;
        }

        return parent::url_is_blocked($urlstring);
    }

    /**
     * @param string $urlstring
     * @return array{host:string,port:int}|null
     */
    private function match_allowed_internal_url(string $urlstring): ?array {
        if ($this->allowedbaseurl === '') {
            return null;
        }

        $allowedbase = $this->parse_url_parts($this->allowedbaseurl);
        $candidate = $this->parse_url_parts(trim($urlstring));
        if ($allowedbase === null || $candidate === null) {
            return null;
        }

        if ($candidate['scheme'] !== $allowedbase['scheme']) {
            return null;
        }
        if ($candidate['host'] !== $allowedbase['host']) {
            return null;
        }
        if ($candidate['port'] !== $allowedbase['port']) {
            return null;
        }

        $requiredprefix = $allowedbase['pathprefix'] . '/v1/internal/moodle/';
        if (!str_starts_with($candidate['path'], $requiredprefix)) {
            return null;
        }

        return [
            'host' => $candidate['host'],
            'port' => $candidate['port'],
        ];
    }

    /**
     * @param string $url
     * @return array{scheme:string,host:string,port:int,path:string,pathprefix:string}|null
     */
    private function parse_url_parts(string $url): ?array {
        $parts = parse_url($url);
        if ($parts === false) {
            return null;
        }

        $scheme = strtolower(trim((string)($parts['scheme'] ?? '')));
        $host = strtolower(trim((string)($parts['host'] ?? '')));
        if ($scheme === '' || $host === '') {
            return null;
        }

        $port = isset($parts['port']) ? (int)$parts['port'] : $this->default_port_for_scheme($scheme);
        if ($port <= 0) {
            return null;
        }

        $path = '/' . ltrim((string)($parts['path'] ?? '/'), '/');
        $pathprefix = rtrim($path, '/');
        if ($pathprefix === '') {
            $pathprefix = '';
        }

        return [
            'scheme' => $scheme,
            'host' => $host,
            'port' => $port,
            'path' => $path,
            'pathprefix' => $pathprefix,
        ];
    }

    /**
     * @param string $scheme
     * @return int
     */
    private function default_port_for_scheme(string $scheme): int {
        if ($scheme === 'https') {
            return 443;
        }
        if ($scheme === 'http') {
            return 80;
        }
        return 0;
    }

    /**
     * @param string $host
     * @return string[]
     */
    private function resolve_allowed_ips(string $host): array {
        if (ip_utils::is_ip_address($host)) {
            return [$host];
        }

        return $this->get_host_list_by_name($host);
    }
}
