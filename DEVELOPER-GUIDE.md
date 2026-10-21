# INVIHA TRACK developer handoff

This folder is the editable source of truth for the INVIHA TRACK web portals and backend. Open `INVIHA-TRACK.code-workspace` in Visual Studio Code or open this folder in Codex. Do not edit files inside `dist/`, deployment payload folders, `.tgz` archives, or VPS web roots; those are generated copies.

The React Native Android/iOS application is stored separately at `C:\Users\madhu\Documents\Codex\m127build`. To open the web platform and mobile application together, use `C:\Users\madhu\Documents\Codex\INVIHA-TRACK-ALL.code-workspace`.

## What you receive

| Area | Editable source | Purpose |
|---|---|---|
| Company portal | `company-admin/frontend/src/` | Company administrators and company users, maps, vehicles, alerts, reports, commands, privacy and login |
| Super Admin portal | `super-admin/frontend/src/` | Platform administration, companies, devices, diagnostics and Main Server Settings |
| Backend API | `backend/` | Authentication, settings, telemetry, alerts, reports, commands, database and Traccar integration |
| Database definitions | `backend/schema.sql` and `backend/migration-*.sql` | Base schema and additive migrations |
| Automated checks | `backend/tests/`, frontend `src/*.test.mjs`, and `driver-identification-tests/` | Regression tests |
| Production operations | versioned deployment scripts and `PRODUCTION-HANDOFF.md` | Backups, guarded deployment, rollback and production verification |

The `dist/` directories are production builds generated from the source. A developer must change `src/`, run tests, and rebuild. Editing a bundled file in `dist/assets/` will be lost on the next build.

## Open in VS Code

1. Open `INVIHA-TRACK.code-workspace`.
2. Open **Terminal → Run Task**.
3. Run **Install all dependencies** once on a new computer.
4. Create `backend/.env` from `backend/.env.example` and add the real development values locally. Never commit `.env`, passwords, private keys, Firebase credentials or production database contents.
5. Run the backend, Company portal and Super Admin portal in separate terminals.

Local addresses:

- Company portal: `http://127.0.0.1:5173/`
- Super Admin portal: `http://127.0.0.1:5174/admin/`
- Backend health: `http://127.0.0.1:3001/health`

Both Vite development servers proxy `/inviha-api` to the local backend by default. Set `VITE_PROXY_TARGET` only when an authorized development environment uses a different backend. Avoid pointing a development UI at production because Save/Delete actions are real API requests.

## Main commands

From `company-admin/frontend/`:

```powershell
npm ci
npm run dev
npm run build
```

From `super-admin/frontend/`:

```powershell
npm ci
npm run dev
npm test
npm run build
```

From `backend/`:

```powershell
npm install
npm start
```

Run the backend test suite from the project root:

```powershell
$tests = Get-ChildItem .\backend\tests\*.test.mjs | Where-Object Name -ne 'device-admission.test.mjs' | ForEach-Object FullName
node --test $tests
```

`device-admission.test.mjs` opens local TCP sockets. Run it separately on a machine that permits local listener tests:

```powershell
node --test .\backend\tests\device-admission.test.mjs
```

## Where to make common changes

- Super Admin Main Server Settings UI: `super-admin/frontend/src/MainServerSettingsPage.jsx`
- Settings categories and validation: `super-admin/frontend/src/settings-sections.mjs`
- Settings API, validation and merge rules: `backend/platform-settings.mjs` and `backend/server.js`
- Company portal screens and navigation: `company-admin/frontend/src/App.jsx`
- Company portal appearance: `company-admin/frontend/src/styles.css`, `fleet-design.css`, and `modern-login.css`
- Super Admin screens and navigation: `super-admin/frontend/src/App.jsx`
- Super Admin appearance: `super-admin/frontend/src/styles.css`
- Alert creation and de-duplication: `backend/rules.mjs`, `backend/alert-rules.mjs`, and related tests
- Mobile push: `backend/mobile-push.mjs`
- Reports: `backend/report-engine.mjs`, `backend/report-normalization.mjs`, and Company portal report components
- Device commands: `backend/command-policy.mjs` and the command page in the Company portal
- Privacy policy and account deletion page: `company-admin/frontend/src/PrivacyPolicy.jsx`

## Required change workflow

1. Make the change only in editable source.
2. Add or update a meaningful regression test when business logic, data handling, permissions, alerts, commands or settings change.
3. Run the affected tests.
4. Build both affected portals.
5. Review the browser locally at desktop and mobile widths.
6. Create a versioned deployment package that includes only reviewed files.
7. Before changing production, create and verify a database/file backup.
8. Deploy, verify health and the live asset, and keep the rollback path printed by the deployment script.
9. Record the release date, files changed, test results and backup path in the release notes.

The current settings-only deployment wrapper is:

`C:\Users\madhu\Documents\Codex\2026-09-14\hey\deploy-super-settings-sections-20261016.ps1`

It only deploys the October 16 Main Server Settings change. It is not a general deployment command for unrelated future features. Create a new guarded, dated deployment wrapper for each future release.

## Production safety

- Production website: `https://track.inviha.com/`
- Super Admin: `https://admin.inviha.com/admin/`
- Backend service directory on the VPS: `/opt/inviha-backend`
- Company web root on the VPS: `/var/www/inviha/company`
- Super Admin web root on the VPS: `/var/www/inviha/admin`
- Deployment backups: `/var/backups/`

Do not place Traccar credentials, database passwords, SSH keys or map-provider secret keys in frontend source. Keep them in the VPS environment or protected settings endpoints. Do not deploy by copying random files directly into a live web root; use a script that builds, hashes, backs up, swaps atomically, verifies and rolls back on failure.

## Current October 16 settings release

The Super Admin Main Server Settings page uses independent category saves. Branding, tracking, general, maps/geocoding, security/retention and deployment notes send only their own allowed fields. The backend atomically merges that category, validates values, protects secret handling and detects same-category concurrent changes.

Validated before deployment:

- Super Admin tests: 12 passed
- Backend suite excluding the socket-only admission test: 115 passed
- Production frontend build: passed
- Live backend health and single listener: passed
- Live backup: `/var/backups/inviha-super-settings-20261016T182954Z`

