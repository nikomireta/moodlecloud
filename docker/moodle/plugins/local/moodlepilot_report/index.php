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

require_once(__DIR__ . '/../../config.php');

use local_moodlepilot_report\local\bootstrap_config;
use local_moodlepilot_report\local\quota_guard;
use local_moodlepilot_report\local\tracking_repository;

require_login();

if (isguestuser()) {
    throw new moodle_exception('noguest');
}

$systemcontext = context_system::instance();
require_capability('moodle/site:config', $systemcontext);

$PAGE->set_context($systemcontext);
$PAGE->set_url(new moodle_url('/local/moodlepilot_report/index.php'));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('dashboard:page_title', 'local_moodlepilot_report'));
$PAGE->set_heading(get_string('dashboard:page_heading', 'local_moodlepilot_report'));
$PAGE->navbar->add(get_string('dashboard:page_title', 'local_moodlepilot_report'));

$renderpairs = static function(array $rows): string {
    if (empty($rows)) {
        return html_writer::tag('p', get_string('dashboard:empty', 'local_moodlepilot_report'));
    }

    $table = new html_table();
    $table->head = ['Item', 'Value'];
    $table->data = array_map(static function(array $row): array {
        return [s((string)$row[0]), s((string)$row[1])];
    }, $rows);
    $table->attributes['class'] = 'generaltable';

    return html_writer::table($table);
};

$rendersection = static function(string $title, string $description, string $body): string {
    $heading = html_writer::tag('h3', s($title));
    $intro = html_writer::tag('p', s($description));
    return html_writer::div($heading . $intro . $body, 'local-moodlepilot-report-section');
};

$renderlist = static function(array $items): string {
    if (empty($items)) {
        return html_writer::tag('p', get_string('dashboard:empty', 'local_moodlepilot_report'));
    }

    $safeitems = array_map(static function(string $item): string {
        return s($item);
    }, $items);

    return html_writer::alist($safeitems);
};

$enabledlabel = static function(bool $enabled): string {
    return $enabled ? 'enabled' : 'disabled';
};

$quotastatuskey = 'unknown';
$quotasourcelabel = get_string('bootstrap:not_configured', 'local_moodlepilot_report');
$quotarows = [
    [
        get_string('quota:status_label', 'local_moodlepilot_report'),
        get_string('quota:status:unknown', 'local_moodlepilot_report'),
    ],
];

$quotastate = quota_guard::current_quota_state(true);
if (is_array($quotastate)) {
    if (!empty($quotastate['over_limit'])) {
        $quotastatuskey = 'over_limit';
    } else if (($quotastate['warning_level'] ?? '') === 'critical') {
        $quotastatuskey = 'critical';
    } else if (($quotastate['warning_level'] ?? '') === 'warning') {
        $quotastatuskey = 'warning';
    } else {
        $quotastatuskey = 'normal';
    }

    $quotasource = trim((string)($quotastate['usage_source'] ?? ''));
    if ($quotasource !== '') {
        $quotasourcelabel = get_string('quota:source:' . $quotasource, 'local_moodlepilot_report');
    }

    $quotarows = [
        [
            get_string('quota:plan_label', 'local_moodlepilot_report'),
            bootstrap_config::display_value(trim((string)($quotastate['plan_code'] ?? ''))),
        ],
        [
            get_string('quota:status_label', 'local_moodlepilot_report'),
            get_string('quota:status:' . $quotastatuskey, 'local_moodlepilot_report'),
        ],
        [
            get_string('quota:users_label', 'local_moodlepilot_report'),
            (string)((int)($quotastate['users_active_count'] ?? 0)) . ' / ' . (string)((int)($quotastate['users_active_limit'] ?? 0)),
        ],
        [
            get_string('quota:storage_label', 'local_moodlepilot_report'),
            display_size((int)($quotastate['storage_bytes_used'] ?? 0)) . ' / ' . display_size((int)($quotastate['storage_bytes_limit'] ?? 0)),
        ],
        [
            get_string('quota:files_label', 'local_moodlepilot_report'),
            display_size((int)($quotastate['files_bytes_used'] ?? 0)),
        ],
        [
            get_string('quota:database_label', 'local_moodlepilot_report'),
            display_size((int)($quotastate['database_bytes_used'] ?? 0)),
        ],
        [
            get_string('quota:last_measured_label', 'local_moodlepilot_report'),
            bootstrap_config::display_value(trim((string)($quotastate['measured_at'] ?? ''))),
        ],
        [
            get_string('quota:source_label', 'local_moodlepilot_report'),
            $quotasourcelabel,
        ],
    ];
}

$connectionrows = [
    [
        get_string('connection:state_label', 'local_moodlepilot_report'),
        get_string('connection:state:' . bootstrap_config::registration_state(), 'local_moodlepilot_report'),
    ],
    [
        get_string('connection:mode_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::connection_mode()),
    ],
    [
        get_string('bootstrap:site_id_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::site_id()),
    ],
    [
        get_string('bootstrap:api_base_url_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::api_base_url()),
    ],
    [
        get_string('connection:bootstrap_endpoint_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::bootstrap_endpoint()),
    ],
    [
        get_string('connection:connect_endpoint_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::connect_endpoint()),
    ],
    [
        get_string('connection:ingest_url_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::ingest_url()),
    ],
    [
        'Plugin version',
        bootstrap_config::display_value(bootstrap_config::plugin_version()),
    ],
    [
        'Moodle version',
        bootstrap_config::display_value(bootstrap_config::moodle_version()),
    ],
    [
        get_string('connection:registered_at_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::registered_at()),
    ],
    [
        get_string('connection:last_push_at_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::last_report_push_at()),
    ],
    [
        get_string('connection:last_error_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::last_bootstrap_error()),
    ],
    [
        get_string('connection:last_ingest_error_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::last_ingest_error()),
    ],
];

$bootstraprows = [
    [
        get_string('bootstrap:state_label', 'local_moodlepilot_report'),
        get_string('bootstrap:state:' . bootstrap_config::bootstrap_state(), 'local_moodlepilot_report'),
    ],
    [
        get_string('bootstrap:site_id_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::provisioned_site_id()),
    ],
    [
        get_string('bootstrap:auto_authorize_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value($enabledlabel(bootstrap_config::auto_authorize_enabled())),
    ],
    [
        get_string('bootstrap:api_base_url_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::provisioned_api_base_url()),
    ],
    [
        get_string('bootstrap:token_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::bootstrap_token_present() ? 'configured' : ''),
    ],
];

$manualrows = [
    [
        get_string('manual:state_label', 'local_moodlepilot_report'),
        get_string('manual:state:' . bootstrap_config::manual_connect_state(), 'local_moodlepilot_report'),
    ],
    [
        get_string('manual:site_id_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::manual_site_id()),
    ],
    [
        get_string('manual:api_base_url_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::manual_api_base_url()),
    ],
    [
        get_string('manual:token_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value(bootstrap_config::manual_registration_token() !== '' ? 'configured' : ''),
    ],
    [
        get_string('manual:reconnect_label', 'local_moodlepilot_report'),
        bootstrap_config::display_value($enabledlabel(bootstrap_config::manual_reconnect_requested())),
    ],
];

$pipelinerows = [
    [
        'Tracking mode',
        bootstrap_config::display_value(bootstrap_config::tracking_mode()),
    ],
    [
        'Tracking interval',
        bootstrap_config::tracking_interval_seconds() . ' s',
    ],
    [
        'Inactivity timeout',
        bootstrap_config::tracking_inactivity_seconds() . ' s',
    ],
    [
        'Last tracking seen',
        bootstrap_config::display_value(bootstrap_config::last_tracking_seen_at()),
    ],
    [
        'Last rollup at',
        bootstrap_config::display_value(bootstrap_config::last_rollup_at()),
    ],
    [
        'Pending detail rows',
        (string)tracking_repository::pending_detail_count(),
    ],
];

$notes = [
    get_string('dashboard:report_surface_note', 'local_moodlepilot_report'),
    'Tracking, rollup, and snapshot ingest remain active in Moodle. This page is for connection status and troubleshooting only.',
    'End-user reporting is available from the Moodlepilot tenant dashboard in the application, not from this Moodle plugin page.',
];

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('dashboard:page_heading', 'local_moodlepilot_report'));
echo html_writer::tag('p', get_string('dashboard:page_intro', 'local_moodlepilot_report'));
echo $OUTPUT->notification(get_string('dashboard:report_surface_note', 'local_moodlepilot_report'), 'info');
if (bootstrap_config::allow_insecure_internal_http()) {
    echo $OUTPUT->notification(get_string('security:insecure_internal_http_warning', 'local_moodlepilot_report'), 'warning');
}
if ($quotastatuskey === 'over_limit') {
    echo $OUTPUT->notification(get_string('dashboard:quota_over_limit_notice', 'local_moodlepilot_report'), 'error');
} else if ($quotastatuskey === 'warning' || $quotastatuskey === 'critical') {
    echo $OUTPUT->notification(get_string('dashboard:quota_warning_notice', 'local_moodlepilot_report'), 'warning');
}

echo $rendersection(
    get_string('dashboard:section_connection', 'local_moodlepilot_report'),
    get_string('connection:description', 'local_moodlepilot_report'),
    $renderpairs($connectionrows)
);

echo $rendersection(
    get_string('bootstrap:heading', 'local_moodlepilot_report'),
    get_string('bootstrap:description', 'local_moodlepilot_report'),
    $renderpairs($bootstraprows)
);

echo $rendersection(
    get_string('manual:heading', 'local_moodlepilot_report'),
    get_string('manual:description', 'local_moodlepilot_report'),
    $renderpairs($manualrows)
);

echo $rendersection(
    get_string('dashboard:section_pipeline', 'local_moodlepilot_report'),
    'Technical health for browser heartbeat collection, rollup processing, and snapshot preparation.',
    $renderpairs($pipelinerows)
);

echo $rendersection(
    get_string('dashboard:section_quota', 'local_moodlepilot_report'),
    get_string('quota:description', 'local_moodlepilot_report'),
    $renderpairs($quotarows)
);

echo $rendersection(
    get_string('dashboard:section_capabilities', 'local_moodlepilot_report'),
    'Capabilities currently advertised by the plugin to the Moodlepilot dashboard ingestion pipeline.',
    $renderlist(bootstrap_config::capabilities())
);

echo $rendersection(
    get_string('dashboard:section_notes', 'local_moodlepilot_report'),
    'Operational notes for admins maintaining the Moodle connector.',
    $renderlist($notes)
);

echo $OUTPUT->footer();
