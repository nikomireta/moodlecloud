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

defined('MOODLE_INTERNAL') || die();

use local_moodlepilot_report\local\bootstrap_config;

if ($hassiteconfig) {
    $ADMIN->add('localplugins', new admin_externalpage(
        'local_moodlepilot_report_dashboard',
        get_string('dashboard:page_title', 'local_moodlepilot_report'),
        new moodle_url('/local/moodlepilot_report/index.php'),
        'moodle/site:config'
    ));

    $settings = new admin_settingpage(
        'local_moodlepilot_report',
        get_string('pluginname', 'local_moodlepilot_report')
    );

    if ($ADMIN->fulltree) {
        $settings->add(new admin_setting_configcheckbox(
            'local_moodlepilot_report/enabled',
            get_string('settings:enabled', 'local_moodlepilot_report'),
            get_string('settings:enabled_desc', 'local_moodlepilot_report'),
            1
        ));

        $items = [
            get_string('bootstrap:state_label', 'local_moodlepilot_report') . ': ' .
                get_string('bootstrap:state:' . bootstrap_config::bootstrap_state(), 'local_moodlepilot_report'),
            get_string('bootstrap:site_id_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::provisioned_site_id()),
            get_string('bootstrap:auto_authorize_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::auto_authorize_enabled() ? 'enabled' : 'disabled'),
            get_string('bootstrap:api_base_url_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::provisioned_api_base_url()),
            get_string('bootstrap:token_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::bootstrap_token_present() ? 'configured' : ''),
        ];

        $manualitems = [
            get_string('manual:state_label', 'local_moodlepilot_report') . ': ' .
                get_string('manual:state:' . bootstrap_config::manual_connect_state(), 'local_moodlepilot_report'),
            get_string('manual:site_id_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::manual_site_id()),
            get_string('manual:api_base_url_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::manual_api_base_url()),
            get_string('manual:token_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::manual_registration_token() !== '' ? 'configured' : ''),
            get_string('manual:reconnect_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::manual_reconnect_requested() ? 'enabled' : 'disabled'),
        ];

        $connectionitems = [
            get_string('connection:state_label', 'local_moodlepilot_report') . ': ' .
                get_string('connection:state:' . bootstrap_config::registration_state(), 'local_moodlepilot_report'),
            get_string('connection:mode_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::connection_mode()),
            get_string('connection:bootstrap_endpoint_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::bootstrap_endpoint()),
            get_string('connection:connect_endpoint_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::connect_endpoint()),
            get_string('connection:ingest_url_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::ingest_url()),
            get_string('connection:ingest_token_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::is_registered() ? 'configured' : ''),
            get_string('connection:registered_at_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::registered_at()),
            get_string('connection:last_error_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::last_bootstrap_error()),
            get_string('connection:last_push_at_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::last_report_push_at()),
            get_string('connection:last_ingest_error_label', 'local_moodlepilot_report') . ': ' .
                bootstrap_config::display_value(bootstrap_config::last_ingest_error()),
        ];

        $details = html_writer::tag(
            'p',
            get_string('bootstrap:description', 'local_moodlepilot_report')
        );
        $details .= html_writer::alist($items);
        $details .= html_writer::tag(
            'p',
            get_string('manual:description', 'local_moodlepilot_report')
        );
        $details .= html_writer::alist($manualitems);
        $details .= html_writer::tag(
            'p',
            get_string('connection:description', 'local_moodlepilot_report')
        );
        $details .= html_writer::alist($connectionitems);

        $settings->add(new admin_setting_heading(
            'local_moodlepilot_report/bootstrap',
            get_string('bootstrap:heading', 'local_moodlepilot_report'),
            $details
        ));

        $settings->add(new admin_setting_heading(
            'local_moodlepilot_report/manualconnect',
            get_string('manual:heading', 'local_moodlepilot_report'),
            get_string('manual:settings_intro', 'local_moodlepilot_report')
        ));

        $settings->add(new admin_setting_configtext(
            'local_moodlepilot_report/manual_site_id',
            get_string('manual:site_id_label', 'local_moodlepilot_report'),
            get_string('manual:site_id_desc', 'local_moodlepilot_report'),
            '',
            PARAM_TEXT
        ));

        $settings->add(new admin_setting_configtext(
            'local_moodlepilot_report/manual_api_base_url',
            get_string('manual:api_base_url_label', 'local_moodlepilot_report'),
            get_string('manual:api_base_url_desc', 'local_moodlepilot_report'),
            '',
            PARAM_URL
        ));

        $settings->add(new admin_setting_configtext(
            'local_moodlepilot_report/manual_registration_token',
            get_string('manual:token_label', 'local_moodlepilot_report'),
            get_string('manual:token_desc', 'local_moodlepilot_report'),
            '',
            PARAM_RAW_TRIMMED
        ));

        $settings->add(new admin_setting_configcheckbox(
            'local_moodlepilot_report/manual_force_reconnect',
            get_string('manual:reconnect_label', 'local_moodlepilot_report'),
            get_string('manual:reconnect_desc', 'local_moodlepilot_report'),
            0
        ));
    }

    $ADMIN->add('localplugins', $settings);
}
