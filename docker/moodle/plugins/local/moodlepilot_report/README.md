# local_moodlepilot_report

Hybrid analytics plugin for Moodlepilot reporting.

## Current purpose

This plugin is the reporting foundation inside each Moodlepilot-managed tenant.
It currently provides:

- automatic bootstrap registration with Moodlepilot
- scheduled summary snapshot ingest to the Moodlepilot backend
- Moodle event journaling for high-signal report events
- browser heartbeat tracking for visits and engaged time
- rollup processing from granular detail buckets into report aggregates
- local admin/debug report pages inside the tenant

## Distribution model

`local_moodlepilot_report` is now intended to support two distribution paths:

- bundled with Moodlepilot tenant images for newly provisioned sites
- standalone as a regular Moodle plugin ZIP for manual install or upgrade

This means the plugin must not depend forever on provisioning-only bootstrap.
The long-term target is one codebase with two connection modes.

## Connection modes

### 1. Auto-bootstrap

For Moodle sites created by Moodlepilot provisioning, authorization is intended
to be automatic.

The plugin receives bootstrap context from provisioning through `$CFG` in
`config.php`:

- `MOODLEPILOT_SITE_ID`
- `MOODLEPILOT_REPORT_AUTO_AUTHORIZE`
- `MOODLEPILOT_API_BASE_URL`
- `MOODLEPILOT_REPORT_BOOTSTRAP_TOKEN`

When the bootstrap context is complete, `bootstrap_registration_task` calls the
Moodlepilot backend, performs the auto-authorize handshake, and stores an
ingest token for future report pushes.

### 2. Manual connect

For non-provisioned Moodle sites, or for tenants where admins install or
upgrade the plugin themselves, the intended model is `manual connect`.

This mode is not fully implemented yet, but it is now part of the product
direction. The plugin will need:

- Moodlepilot API base URL setting
- registration or connect token input
- connection status display
- reconnect and sync controls

After manual connect succeeds, the downstream pipeline should be identical to
auto-bootstrap: event journaling, heartbeat tracking, rollup, and snapshot
ingest.

## Current pipeline

1. Tenant is provisioned with Moodlepilot bootstrap config.
2. `bootstrap_registration_task` registers the plugin automatically.
3. Browser heartbeat tracking writes granular rows to `local_mpilot_rpt_detail`.
4. Moodle event observers write high-signal events to `local_mpilot_rpt_event`.
5. `tracking_rollup_task` compresses detail rows into aggregate tracking tables.
6. `report_snapshot_ingest_task` builds the 7-day snapshot and pushes it to Moodlepilot.

## Upgrade and release direction

Because admins may upgrade the plugin directly in Moodle, the plugin must be
upgrade-safe through `db/upgrade.php` and should not rely on container access
for normal recovery.

The intended release model is:

- same source code builds the Moodlepilot image bundle
- same source code is packaged as a plugin ZIP
- future releases can be published through normal Moodle plugin channels

## Still out of scope for this milestone

- export flows
- role-specific dashboards
- multi-period report windows beyond `last_7_days`
- full manual connect flow for non-provisioned Moodle sites
- ZIP release automation and Moodle plugin repository submission workflow
