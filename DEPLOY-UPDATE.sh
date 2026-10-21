#!/usr/bin/env bash
# INVIHA production UI, telemetry and existing Teltonika/RFID update.
set -Eeuo pipefail
umask 077
[[ $(id -u) -eq 0 ]] || { echo 'Run this installer as root.'; exit 1; }
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
backend=/opt/inviha-backend
company_web=/var/www/inviha/company
admin_web=/var/www/inviha/admin
service=inviha-backend
for command in node curl systemctl sha256sum flock tar pg_dump pg_restore timeout install find cmp readlink; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command"; exit 1; }
done
(cd "$release"; sha256sum --check --quiet SHA256SUMS)
exec 9>/var/lock/inviha-deploy.lock
flock -n 9 || { echo 'Another INVIHA deployment is running.'; exit 1; }
for directory in "$backend" "$company_web" "$admin_web"; do
  [[ -d "$directory" && ! -L "$directory" ]] || { echo "Expected existing directory: $directory"; exit 1; }
done
[[ -f "$backend/.env" && ! -L "$backend/.env" && -d "$backend/node_modules" ]] || { echo 'Existing backend configuration and dependencies are required.'; exit 1; }
for web in "$company_web" "$admin_web"; do
  [[ -f "$web/index.html" && ! -L "$web/index.html" ]] || { echo "Existing portal index is required: $web"; exit 1; }
done
systemctl is-active --quiet "$service"
[[ $(systemctl show "$service" -p WorkingDirectory --value) == "$backend" ]] || { echo 'Unexpected service working directory; stopped for review.'; exit 1; }
node "$release/DEPLOY-SUPPORT.mjs" baseline "$backend"
node "$release/DEPLOY-SUPPORT.mjs" web-baseline "$company_web" "$admin_web"
if [[ ! -e "$release/backend/node_modules" ]]; then ln -s "$backend/node_modules" "$release/backend/node_modules"; fi
[[ $(readlink -f "$release/backend/node_modules") == $(readlink -f "$backend/node_modules") ]] || { echo 'Unexpected staged dependencies.'; exit 1; }
for file in "$release"/backend/*.mjs; do node --check "$file"; done
# Works with the VPS Node 18 ESM parser even without a package manifest.
node --input-type=module --check < "$release/backend/server.js"
port=$(node "$release/DEPLOY-SUPPORT.mjs" port "$backend")
healthy() {
  systemctl is-active --quiet "$service" &&
  curl --noproxy '*' --fail --silent --max-time 4 "http://127.0.0.1:$port/health" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const x=JSON.parse(s);process.exit(x.ok===true&&x.service==="inviha-track-backend"&&x.release==="v4"?0:1)}catch{process.exit(1)}})'
}
wait_healthy() {
  local count=0
  for attempt in {1..15}; do
    if healthy; then count=$((count+1)); else count=0; fi
    if [[ $count -ge 3 ]]; then return 0; fi
    sleep 2
  done
  return 1
}
healthy || { echo 'Existing backend is not healthy; no live files changed.'; exit 1; }
echo 'Checking existing driver records (read only)...'
(cd "$backend"; timeout 60s node "$release/backend/check-driver-identification.mjs")
# Verify which existing virtual host serves BOTH installed portals before touching them.
web_base=''
web_fetch() {
  curl --noproxy '*' --resolve track.inviha.com:443:127.0.0.1 --resolve track.inviha.com:80:127.0.0.1 --resolve 134.122.92.105:80:127.0.0.1 --fail --silent --show-error --max-time 10 "$web_base$1"
}
for candidate in https://track.inviha.com http://track.inviha.com http://134.122.92.105; do
  web_base=$candidate
  if web_fetch / | cmp -s - "$company_web/index.html" && web_fetch /admin/ | cmp -s - "$admin_web/index.html" && web_fetch /inviha-api/api/auth/setup-status >/dev/null; then break; fi
  web_base=''
done
[[ -n "$web_base" ]] || { echo 'Could not verify both existing web portals. No live files changed; send this output for review.'; exit 1; }
echo "Verified existing portals: $web_base"
stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
backup=/var/backups/inviha-ui-update-$stamp
install -d -m 700 "$backup" "$backup/backend" "$backup/company" "$backup/admin"
while IFS= read -r file; do cp -a -- "$backend/$file" "$backup/backend/$file"; done < <(node "$release/DEPLOY-SUPPORT.mjs" existing "$backend")
cp -a -- "$company_web/." "$backup/company/"
cp -a -- "$admin_web/." "$backup/admin/"
cp -a -- "$backend/.env" "$backup/backend.env"
env_hash=$(sha256sum "$backend/.env" | cut -d' ' -f1)
echo 'Creating and verifying an application database backup...'
timeout 180s node "$release/DEPLOY-SUPPORT.mjs" backup "$backend" "$backup/application.dump"
echo "Backup ready: $backup"
changed=0
web_changed=0
restore_web() {
  local saved=$1 target=$2 file
  for file in "$saved/"* "$saved/".[!.]* "$saved/"..?*; do
    [[ -e "$file" ]] || continue
    [[ $(basename -- "$file") == index.html ]] && continue
    cp -a -- "$file" "$target/" || return 1
  done
  cp -a -- "$saved/index.html" "$target/.index-rollback-$stamp" && mv -f -- "$target/.index-rollback-$stamp" "$target/index.html"
}
rollback() {
  local code=$1 restored=1
  trap - ERR INT TERM
  set +e
  echo 'Update failed or was interrupted. Restoring previous application files...'
  if [[ $changed -eq 1 ]]; then
    systemctl stop "$service"
    cp -a -- "$backup/backend/." "$backend/" || restored=0
    node "$release/DEPLOY-SUPPORT.mjs" baseline "$backend" || restored=0
  fi
  if [[ $web_changed -eq 1 ]]; then
    restore_web "$backup/company" "$company_web" || restored=0
    restore_web "$backup/admin" "$admin_web" || restored=0
  fi
  if [[ $changed -eq 1 ]]; then
    systemctl start "$service"
    if wait_healthy && [[ $restored -eq 1 ]]; then echo 'Previous application files restored; backend healthy.'; else echo 'ATTENTION: application recovery needs review.'; fi
  fi
  echo "Backup: $backup"
  echo 'Additive tables and captured history were retained. No database restore was performed.'
  exit "$code"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
changed=1
systemctl stop "$service"
node "$release/DEPLOY-SUPPORT.mjs" baseline "$backend"
node "$release/DEPLOY-SUPPORT.mjs" web-baseline "$company_web" "$admin_web"
(cd "$backend"; timeout 60s node "$release/backend/check-driver-identification.mjs")
while IFS= read -r file; do
  install -m 644 -- "$release/backend/$file" "$backend/.$file.ui-update-$stamp"
  mv -f -- "$backend/.$file.ui-update-$stamp" "$backend/$file"
done < <(node "$release/DEPLOY-SUPPORT.mjs" files "$backend")
systemctl start "$service"
wait_healthy
node "$release/DEPLOY-SUPPORT.mjs" updated "$backend"
timeout 60s node "$release/DEPLOY-SUPPORT.mjs" schema "$backend"
[[ $(sha256sum "$backend/.env" | cut -d' ' -f1) == "$env_hash" ]]
publish_web() {
  local source=$1 target=$2 file relative
  while IFS= read -r -d '' file; do
    relative=${file#"$source/"}
    [[ "$relative" == index.html ]] && continue
    install -d -m 755 -- "$(dirname -- "$target/$relative")"
    install -m 644 -- "$file" "$target/$relative"
  done < <(find "$source" -type f -print0)
  install -m 644 "$source/index.html" "$target/.index-ui-update-$stamp"
  mv -f -- "$target/.index-ui-update-$stamp" "$target/index.html"
}
web_changed=1
publish_web "$release/company-admin/frontend/dist" "$company_web"
publish_web "$release/super-admin/frontend/dist" "$admin_web"
web_fetch / > "$backup/served-company.html"
cmp -s "$backup/served-company.html" "$release/company-admin/frontend/dist/index.html"
web_fetch /admin/ > "$backup/served-admin.html"
cmp -s "$backup/served-admin.html" "$release/super-admin/frontend/dist/index.html"
web_fetch /inviha-api/api/auth/setup-status > /dev/null
for route in /api/driver-identification/stream /api/device-models /api/sensor-templates /api/vehicles/1/io; do
  [[ $(curl --noproxy '*' --silent --max-time 10 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$port$route") == 401 ]]
done
healthy
trap - ERR INT TERM
echo
echo 'SUCCESS: complete production UI, Sensors & I/O and RFID/iButton update installed.'
echo 'Backend, both admin portals, database schema and authentication checks passed.'
echo "Backup: $backup"
echo 'Refresh both dashboards with Ctrl+F5, then confirm the exact tracker labels and test installed readers.'
