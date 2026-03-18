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

$string['pluginname'] = 'Moodlepilot report';
$string['privacy:metadata'] = 'The Moodlepilot report plugin scaffold does not store personal data yet.';

$string['settings:enabled'] = 'Enable plugin scaffold';
$string['settings:enabled_desc'] = 'Keeps the Moodlepilot reporting scaffold enabled for this tenant.';

$string['bootstrap:heading'] = 'Bootstrap status';
$string['bootstrap:description'] = 'This plugin is installed by Moodlepilot provisioning. Sites created by Moodlepilot are expected to use automatic authorization instead of a manual connect flow.';
$string['bootstrap:state_label'] = 'Bootstrap state';
$string['bootstrap:site_id_label'] = 'Provisioned site ID';
$string['bootstrap:auto_authorize_label'] = 'Auto-authorize mode';
$string['bootstrap:api_base_url_label'] = 'Backend API base URL';
$string['bootstrap:token_label'] = 'Bootstrap token';
$string['bootstrap:not_configured'] = 'Not configured';

$string['bootstrap:state:missing_site_id'] = 'Missing site bootstrap';
$string['bootstrap:state:disabled'] = 'Auto-authorize disabled';
$string['bootstrap:state:partial'] = 'Partial bootstrap';
$string['bootstrap:state:ready'] = 'Ready for registration handshake';

$string['connection:description'] = 'The plugin attempts automatic registration with Moodlepilot using a scheduled task. Once registration succeeds, the tenant receives an ingest token for future report pushes.';
$string['connection:state_label'] = 'Connection state';
$string['connection:bootstrap_endpoint_label'] = 'Bootstrap endpoint';
$string['connection:ingest_url_label'] = 'Ingest URL';
$string['connection:ingest_token_label'] = 'Ingest token';
$string['connection:registered_at_label'] = 'Registered at';
$string['connection:last_error_label'] = 'Last bootstrap error';
$string['connection:last_push_at_label'] = 'Last report push';
$string['connection:last_ingest_error_label'] = 'Last ingest error';
$string['connection:state:pending'] = 'Pending automatic registration';
$string['connection:state:bootstrap_incomplete'] = 'Waiting for full bootstrap config';
$string['connection:state:registered'] = 'Registered with Moodlepilot';
$string['connection:state:error'] = 'Registration error';
$string['connection:state:disabled'] = 'Disabled';
$string['connection:error_unknown'] = 'Unknown bootstrap error';
$string['connection:error_invalid_payload'] = 'Unable to encode bootstrap payload.';
$string['connection:error_missing_ingest_token'] = 'Bootstrap response did not include an ingest token.';

$string['task:bootstrap_registration'] = 'Register Moodlepilot report plugin';
$string['task:report_snapshot_ingest'] = 'Push Moodlepilot report snapshot';

$string['report:error_not_registered'] = 'Plugin is waiting for automatic registration before pushing reports.';
$string['report:error_missing_ingest_target'] = 'Ingest target is not fully configured yet.';
$string['report:error_invalid_payload'] = 'Unable to encode report snapshot payload.';
$string['report:error_unknown'] = 'Unknown report ingest error.';
