# INVIHA TRACK — complete prepared update, September 21, 2026

> **Current developer instructions:** open `INVIHA-TRACK.code-workspace` and read `DEVELOPER-GUIDE.md`. The release notes below preserve historical context and are not the current development or deployment checklist.

This package contains the latest locally prepared source and production builds for track.inviha.com. It has **not been installed on the VPS by this task**. It is an application update archive, **not a complete backup of the current live server**: it contains no production database, credentials, `.env`, uploaded files, GPS history, or server configuration backup.

Before packaging, the live VPS `backend/rules.mjs` was read-only reviewed and preserved because it contained a newer alert de-duplication implementation than the earlier release baseline. This prevents the UI deployment from overwriting or regressing that production alert behavior.

The September 15 release remains available separately. Both copies of its ZIP were checked on September 20 and contain identical files; all recorded checksums pass. The live dashboard previously showed September 15 features, but the current live server's complete contents have not been copied or independently verified for this archive.

## Changes included

- Compact “Stopped since 2 hrs ago” text in vehicle details, map popups and lists. It uses the backend's persisted ignition-off timestamp; no seconds or large timer. A first observed parked record cannot establish an earlier historical stop; the tooltip explains this.
- Updated company and super-admin login, driver forms, vehicle details, buttons, grouped advanced settings, map status cards and icon/image selection using the supplied design references. Existing email/password authentication remains.
- Forty-five selectable vehicle symbols, connected to the existing saved vehicle category and map markers.
- Real core telemetry and assigned I/O readings, including sensor visibility when a company vehicle has no GPS coordinates. Unknown readings remain unavailable.
- Same-model sensor templates in Master Data and Sensors & I/O. Templates fill available inputs, preserve existing assignments, enforce shared-pin conflicts, exclude outputs, and require reader installation verification on each vehicle.
- Explicit DIN ignition mappings reach engine/stop logic. A single calibrated Celsius temperature mapping reaches the existing temperature alert field; multiple probes remain separately named. Analog inputs initially use volts and require verified calibration for physical units.
- Configured minimum movement speed is validated and used by backend and map classification. Both portal shapes support the assigned speed limit display. Existing immobilizer permissions and command safety checks remain.
- English, Arabic and Hindi selection persists. Navigation and common labels are translated; technical settings, report content and device-provided names retain their original text.
- Previous RFID/iButton identity/history, exact Teltonika device profiles, company-creation mandatory field selection, sensor dropdown and lower-right map controls are retained.
- RFID/iButton matching now preserves raw decoded values and leading zeroes, accepts hexadecimal, `0x`, separated-byte and byte-array input, and safely matches byte-equivalent Teltonika hexadecimal and GT06 decimal iButton forms. Byte-equivalent identifiers cannot be assigned to two active drivers in the same company.
- Added the requested Sensors & I/O page action and Add Sensor dialog. It supports searchable vehicle selection, All Vehicles or individual vehicles, sensor name/template/parameter selection, binary conversion with configurable ON/OFF labels, history retention, and Save/Cancel. Saved mappings are attached to the existing company vehicle records and appear in each vehicle's sensor list.

Unsupported controls in the design pictures are represented by the existing supported settings. This update does not add SSO, invent hardware capabilities, enable new protocol listeners or claim complete translation of every report and technical field. Photo upload keeps the existing 250 KB limit. No real sensor values or sample accounts are bundled into production data.

## Source and build contents

`backend/`, `company-admin/frontend/`, `super-admin/frontend/` and `driver-identification-tests/` contain the source and tests. Both frontend folders include compiled `dist/` builds. `SOURCE-MANIFEST.json` lists every included source hash, changed/reference status and exactly which backend files are installed. Secrets, dependencies, npm caches, old broken source copies and local browser fixtures are excluded.

The reviewed working source remains at `work/stop-duration-v2/project` in this task. No unrelated project folder is overwritten by packaging.

## Validation and limits

See `VALIDATION.txt` for completed build, application, installer and archive checks. Browser checks used the real compiled frontends with an isolated local API fixture; they did not modify production records. Hardware-specific ignition, installed readers, physical sensor calibration, output acknowledgements and the resulting live deployment still require verification against the user's devices.

`PRODUCTION-HANDOFF.md` explains the complete device-to-Traccar-to-backend data path, protocol ports, Cloudflare/DNS requirement, firewall checks, backend API connections, RFID/iButton setup, source map, PowerShell deployment command, backup behavior and post-deployment checks.

## Optional installation

Keeping this ZIP is sufficient for preserving this application version. Opening or extracting it does not install anything.

To install later, keep `DEPLOY-INVIHA-COMPLETE-UPDATE.ps1` beside `INVIHA-TRACK-COMPLETE-2026-09-21.zip` and run the script from Windows PowerShell using the user's working SSH profile:

```powershell
& "C:\Users\madhu\Documents\Codex\2026-09-14\hey\outputs\DEPLOY-INVIHA-COMPLETE-UPDATE.ps1"
```

The installer verifies archive hashes, known backend versions, both served portals and their reviewed built assets before installation. If the VPS has newer or different files, it stops for review. It backs up affected backend files, both web roots, `.env` and a verified PostgreSQL dump under `/var/backups/inviha-ui-update-<timestamp>`. It preserves existing configuration and data, uses additive database migrations, and attempts file rollback if activation fails. It does not automatically restore the database or erase captured history.

Keep the PowerShell window open until it reports SUCCESS. If it fails, retain the final output for review and do not bypass the baseline checks. After success, refresh both dashboards with Ctrl+F5 and verify the installed physical sensors and readers.

## September 21 live-map vehicle card update

The live map vehicle list now uses compact status cards with centered group labels and transparent vehicle artwork. Each vehicle has a three-dot action menu for View Details, Edit Vehicle, History - Last Hour, History - Yesterday, and Send Command. The history choices open Playback with the exact date range and load it automatically. Send Command uses the existing immobilizer permission, relay configuration, stationary, ignition-off, and fresh-telemetry safety checks. Map tool buttons are grouped directly below Map / Satellite at the upper-right of the map.

## September 21 final live-map layout update

The global search field beside the header logo is removed; the vehicle-panel search remains. Status groups now use a left icon and left-aligned label with the expand chevron on the far right. The vehicle list continues to scroll with the mouse wheel while its scrollbar is hidden.

Each vehicle card has one vertical three-dot action button. Its menu is rendered above the map layer and positioned immediately beside the selected card, with automatic left-side fallback near the screen edge. The menu provides View Details, Edit Vehicle, History - Last Hour, History - Yesterday and Send Command.

Map markers use the vehicle's saved category, preserve transparent backgrounds and dark window/detail areas, rotate from the tracker heading, and color the full body by state: green moving, orange idle, purple parked, bright red currently untracked, dark red offline and gray not tracked yet. The duplicate Sensors & I/O tab was removed from Edit Vehicle because the dedicated Sensors page owns sensor and physical I/O management.


## Complete update 9 — engine and fleet speed correction

- A confirmed ignition OFF now displays **Engine OFF** throughout Company Admin, including stale last-known parked positions.
- Ignition ON continues to use direct RPM/signal data first, then each vehicle's configured voltage source, ON/OFF thresholds, hysteresis and debounce. The system does not invent an ON state when the required reading is absent.
- **Sensors & I/O → Add Sensor → Engine (Voltage)** configures the voltage source key, running threshold, off threshold and debounce for one vehicle, selected vehicles or all vehicles.
- **Settings → Alerts → Fleet Speed Limit** is the company default used by every vehicle's live speed sign, trail coloring, playback and backend overspeed fallback. A vehicle-specific limit or targeted active rule remains an intentional override.


## Complete update 10 — centered loading animation

- Replaces the bottom loading card with the supplied animated SVG, centered over the viewport after a short delay.
- Automatic live-data refresh failures keep the last received positions and retry quietly instead of leaving a persistent bottom-right message.
- Normal save, validation, permission and authentication errors still use the existing notifications.
