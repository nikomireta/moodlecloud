# local_moodlepilot_report

Scaffold plugin for Moodlepilot reporting.

## Current purpose

This plugin is the foundation for Moodlepilot reporting inside each provisioned
tenant. At this stage it does not push report data yet. It establishes:

- a stable plugin component name
- a place for future reporting logic
- bootstrap visibility inside Moodle admin
- image-level installation for every newly provisioned site
- automatic bootstrap registration with Moodlepilot through a scheduled task

## Bootstrap model

For Moodle sites created by Moodlepilot provisioning, authorization is intended
to be automatic.

The current scaffold already receives a minimal bootstrap context from
provisioning:

- `MOODLEPILOT_SITE_ID`
- `MOODLEPILOT_REPORT_AUTO_AUTHORIZE`
- `MOODLEPILOT_API_BASE_URL`
- `MOODLEPILOT_REPORT_BOOTSTRAP_TOKEN`

These values are exposed to Moodle through `$CFG` in `config.php`.

When the bootstrap context is complete, the plugin scheduled task will call the
Moodlepilot backend, perform the auto-authorize handshake, and store an ingest
token in plugin config for future report pushes.

## Not implemented yet

- scheduled report aggregation and push
- report pages inside Moodle
- export flows
- role-specific dashboards

## Why this plugin exists now

It gives Moodlepilot a real plugin anchor inside the tenant image, so future
reporting work can extend an installed component instead of starting from
scratch.
