# INVIHA TRACK production handoff

This guide explains the production data path, RFID/iButton handling, tracker ports, VPS services, firewall checks, deployment, backup and verification. It does not contain passwords, database contents, private keys or production `.env` values.

## What this release does

- Preserves RFID/iButton values as text so leading zeroes are not lost.
- Accepts decoded text, hexadecimal text, `0x` notation, colon/dash/space-separated byte notation, numeric identifiers and decoded byte arrays.
- Converts byte-equivalent Teltonika hexadecimal and GT06 decimal iButton forms for matching while retaining the original received value in identification history.
- Rejects unsafe JavaScript numbers, empty/all-zero identifiers, unverified reader mappings, duplicate active identifiers and byte-equivalent identifiers assigned to different drivers.
- Keeps tenant separation: the same identifier may be used by different companies but cannot belong to two active drivers in one company.
- Records matched and unknown identification events, vehicle/driver sessions and historical report attribution.
- Keeps the live production alert de-duplication, mobile-push initialization and stop/activity telemetry logic that were reviewed from the VPS.
- Adds the requested Sensors & I/O Add Sensor dialog and real saved vehicle sensor mappings.

## Production data flow

```text
Tracker / reader
  -> public DNS or VPS IP
  -> VPS TCP firewall
  -> Traccar protocol listener (GT06 5023 or Teltonika 5027)
  -> Traccar device and position storage
  -> INVIHA backend through Traccar API/database
  -> decoded I/O mapping and driver matching
  -> INVIHA PostgreSQL history
  -> /inviha-api
  -> Company and Super Admin web portals
```

The INVIHA Node backend is not the raw tracker socket receiver. Traccar receives and decodes tracker packets. The Node backend normally listens on `127.0.0.1:3001`, uses the Traccar API at `127.0.0.1:8082`, and is exposed to the browser by the web server under `/inviha-api`.

`TRACKER_PORT` in the Node `.env` is only a diagnostic fallback for the GT06 profile. It does not open a port or start a tracker receiver.

## Device hostname and Cloudflare

At review time, `track.inviha.com` resolved through the Cloudflare proxy. Ordinary Cloudflare proxying does not forward arbitrary tracker TCP traffic on ports 5023 or 5027. That is why a device can be configured correctly and still appear offline.

Recommended configuration:

1. Keep `track.inviha.com` for the website.
2. Create an A record such as `gps.track.inviha.com` pointing to `134.122.92.105`.
3. Set that tracker record to **DNS only** / grey cloud.
4. Configure devices with `gps.track.inviha.com` and the one port matching their protocol.

To use the exact hostname `track.inviha.com` in a device, the root record must be DNS only, or a TCP proxy product capable of forwarding the required port must be configured. Changing the root record from proxied to DNS only changes how the website is exposed, so verify the VPS web TLS certificate and web firewall before doing that.

## Protocol and port mapping

| Device protocol | Transport | Destination port | INVIHA vehicle protocol |
|---|---:|---:|---|
| Teltonika | TCP | 5027 | Teltonika |
| GT06 / common H9 variants | TCP | 5023 | GT06 |

Configure one protocol and one matching port. Do not send the same tracker to both ports. Traccar lists these protocol ports in its official [supported devices list](https://www.traccar.org/devices), and its [protocol identification guide](https://www.traccar.org/identify-protocol/) identifies GT06 on 5023.

## VPS read-only checks

Run these from Windows PowerShell:

```powershell
ssh root@134.122.92.105 "ss -lntup | grep -E ':5023|:5027|:8082|:3001'"
ssh root@134.122.92.105 "docker ps --format 'table {{.Names}}\t{{.Ports}}'"
ssh root@134.122.92.105 "ufw status numbered"
ssh root@134.122.92.105 "systemctl status inviha-backend --no-pager"
```

Expected result: Traccar is listening on the protocol port, the INVIHA backend is active on its internal port, and the public tracker port is allowed by the VPS firewall and any DigitalOcean cloud firewall.

To inspect Traccar after a device sends a packet, replace `<traccar-container>` with its real container name:

```powershell
ssh root@134.122.92.105 "docker logs --since 10m <traccar-container> 2>&1 | grep -Ei 'teltonika|gt06|5027|5023|connected|unknown|error'"
```

## Firewall changes when the listeners already exist

Only run these after `ss` confirms that Traccar is intended to listen on the ports:

```powershell
ssh root@134.122.92.105 "ufw allow 5023/tcp comment 'GT06 trackers'"
ssh root@134.122.92.105 "ufw allow 5027/tcp comment 'Teltonika trackers'"
ssh root@134.122.92.105 "ufw status numbered"
```

If a DigitalOcean Cloud Firewall is attached, allow inbound TCP 5023 and/or 5027 there as well. Opening a firewall port without a Traccar listener does not make the service work.

## Tracker setup

For Teltonika:

- Server: `gps.track.inviha.com` or `134.122.92.105`
- Port: `5027`
- Protocol: TCP
- Device IMEI: the same value registered in Traccar and the INVIHA vehicle
- Reader: installed on the model-supported 1-Wire, BLE, RS232 or RS485 channel
- Teltonika iButton event: decoded by Traccar as `driverUniqueId`; event 78 is treated as an explicit tap

For GT06/H9:

- Server: `gps.track.inviha.com` or `134.122.92.105`
- Port: `5023`
- Protocol: TCP
- Device ID/IMEI: the same unique ID registered in Traccar and INVIHA
- The actual hardware/firmware must support and transmit the RFID/iButton value; a generic GT06 location packet cannot provide a reader value that the hardware never sends

The SIM must have a working APN and mobile data. Device time must be valid. Confirm the tracker sends after configuration; some devices require a restart or save/reboot command.

## RFID/iButton configuration in INVIHA

1. Register the vehicle with the exact IMEI, protocol and Teltonika model when applicable.
2. Open the vehicle I/O mapping and assign only the physically installed reader channel.
3. Select `iButton Driver ID` for 1-Wire, or the supported RFID function for BLE/RS232/RS485.
4. Select the actual decoded Traccar field. Common supported identity fields are `driverUniqueId`, `driverIdentifier`, `rfid`, `ibutton` and `iButton`.
5. Check **Installed reader and decoded identifier verified** only after seeing the field in a real device packet.
6. Add the driver identifier exactly as decoded. Leading zeroes are retained. Byte formats are normalized for matching.
7. Tap the key/card and verify Current Driver, Events and Driver Report.

Ignition, battery and unrelated numeric sensor values are never accepted as driver identity.

## Required backend environment connections

The existing `/opt/inviha-backend/.env` is preserved by the installer. Relevant keys are:

```text
PORT=3001
DATABASE_URL=<INVIHA application PostgreSQL connection>
TRACCAR_BASE_URL=http://127.0.0.1:8082
TRACCAR_ADMIN_EMAIL=<server-side Traccar account>
TRACCAR_ADMIN_PASSWORD=<server-side secret>
TRACCAR_DATABASE_URL=<optional direct read-only/live Traccar database connection>
OFFLINE_MINUTES=<offline threshold>
TRACKER_PORT=5023
```

Traccar credentials must stay on the server. They must never be placed in React/Vite frontend files or this archive.

## Source map

- `backend/server.js`: authentication, companies, vehicles, diagnostics, Traccar API access and application endpoints.
- `backend/device-profile-rules.mjs`: exact model capabilities, channel validation and decoded I/O mapping.
- `backend/driver-identity.mjs`: identifier validation, raw byte preservation and byte-equivalent aliases.
- `backend/driver-identification.mjs`: tenant-safe driver matching, sessions and history.
- `backend/driver-worker.mjs`: reads new Traccar positions and commits identification events.
- `backend/migration-driver-identification.sql`: additive driver identity tables and constraints.
- `company-admin/frontend/src/DriverIdentification.jsx`: driver identifiers and vehicle reader settings.
- `company-admin/frontend/src/SensorConfigForm.jsx`: requested Add Sensor dialog.
- `SOURCE-MANIFEST.json`: hashes and the exact backend files eligible for installation.
- `SHA256SUMS`: checksum for every file inside the release.

## Deployment

Keep the ZIP and PowerShell wrapper together. Run from Windows PowerShell, outside an SSH session:

```powershell
& "C:\Users\madhu\Documents\Codex\2026-09-14\hey\outputs\DEPLOY-INVIHA-COMPLETE-UPDATE.ps1"
```

The wrapper verifies the ZIP hash, uploads it, extracts it into a unique staging directory, and runs the guarded installer. The installer verifies the reviewed backend and web versions before mutation, creates a database dump and file backup, applies additive migrations, installs the reviewed files, restarts the service, verifies health and checks both served portals.

Backups are stored under:

```text
/var/backups/inviha-ui-update-<UTC timestamp>
```

If a source or portal differs from the reviewed versions, the installer stops before installation. Do not bypass that guard. Download the named live file for review and rebuild the package.

## Post-deployment verification

```powershell
ssh root@134.122.92.105 "systemctl is-active inviha-backend"
ssh root@134.122.92.105 "curl --fail --silent http://127.0.0.1:3001/health"
ssh root@134.122.92.105 "ss -lntup | grep -E ':5023|:5027'"
```

Then refresh both portals with Ctrl+F5, open Super Admin diagnostics, confirm the vehicle IMEI/protocol/model, tap one registered key and one unregistered key, and verify Current Driver plus the event history.

## Device admission gateway

The public GT06 and Teltonika ports must terminate at `device-admission-gateway.mjs`. Traccar listens only through loopback forwarding ports (`15023` and `15027`). The gateway reads the first protocol login packet, extracts the IMEI and checks an in-memory list of active, customer-assigned vehicles. Registered IMEIs pass to Traccar. Unknown and declined IMEIs are disconnected before telemetry is decoded or stored.

Unknown attempts are summarized in `device_admission_attempts` at most once per 30-second batch. Super Admin → Logs → Unregistered Vehicles provides Accept & assign, Decline, Restore and Delete. Accepting creates the vehicle for the selected company and removes the matching unknown-device record.

The service is installed from `backend/inviha-device-admission.service`. The Traccar container bindings must be loopback-only:

```text
127.0.0.1:15023 -> container 5023
127.0.0.1:15027 -> container 5027
```

The admission service then binds the public ports:

```text
0.0.0.0:5023 -> GT06 gate -> 127.0.0.1:15023
0.0.0.0:5027 -> Teltonika gate -> 127.0.0.1:15027
```

## What still requires the real device

Software tests verify parsing, matching, tenant isolation, history and deployment safeguards. They cannot prove the physical reader wiring, SIM/APN, device firmware, Cloudflare/DNS state, VPS firewall state or Traccar listener state. Those must be verified with an actual packet from the installed device. No demo or invented sensor values are used.
