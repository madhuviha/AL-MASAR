# Local Development and Deployment Workflow

## Start after a laptop restart

Open three PowerShell terminals. Keep the first two running.

### Terminal 1: backend

```powershell
cd "C:\Users\madhu\Documents\Codex\2026-09-14\hey\work\release-baseline-vehicle-modal-v12\backend"
$env:ALLOWED_ORIGINS="http://127.0.0.1:5177,http://127.0.0.1:5178,http://localhost:5177,http://localhost:5178"
npm.cmd start
```

Wait for `INVIHA backend listening on http://127.0.0.1:3001`.

### Terminal 2: Company User frontend

```powershell
cd "C:\Users\madhu\Documents\Codex\2026-09-14\hey\work\release-baseline-vehicle-modal-v12\company-admin\frontend"
npm.cmd run dev -- --host 127.0.0.1 --port 5177
```

Open `http://127.0.0.1:5177/`.

### Terminal 3: Super Admin frontend

```powershell
cd "C:\Users\madhu\Documents\Codex\2026-09-14\hey\work\release-baseline-vehicle-modal-v12\super-admin\frontend"
$env:VITE_PROXY_TARGET="http://127.0.0.1:3001"
npm.cmd run dev -- --host 127.0.0.1 --port 5178
```

Open `http://127.0.0.1:5178/admin/`.

## Important rules

- Do not start a second backend if port 3001 is already in use; the backend is already running.
- Port 5177 is the Company User portal. Port 5178 is the Super Admin portal.
- Test all edits locally before deployment. Keep the backend and both frontend terminals running while testing.
- The local demo company account is `demo.admin@example.com` with password `DemoFleet@2026`.
- The Super Admin account is used only at port 5178.

## Check a port

```powershell
Get-NetTCPConnection -LocalPort 3001,5177,5178 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort,OwningProcess
```

## Safe edit and deployment flow

1. Edit source files in the repository.
2. Restart the affected local frontend if needed.
3. Test both portals and the changed feature locally.
4. Run the project build for the frontend you changed:

```powershell
npm.cmd run build
```

5. Review the build output and changes before deployment.
6. Deploy only after local testing passes, using the repository deployment script or the approved deployment procedure.
7. Check the live site after deployment and keep a backup of the previous live release.

## Recovery after a crash

- Reopen the repository folder in VS Code.
- Start the three terminals using the commands above.
- If a port is occupied, reuse the running process or stop only the process shown by `Get-NetTCPConnection`.
- Your source edits remain in the repository; do not reset or delete the worktree when recovering.
