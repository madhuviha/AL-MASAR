#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-main-server-settings-20261003.tgz
expected_sha=a42f42f96c4f455cc87c13d44d67d7d393afe2bb9ac650120ea47d4b4293d5f4
backend=/opt/inviha-backend
company_web=/var/www/inviha/company
admin_web=/var/www/inviha/admin
backend_service=inviha-backend.service
admission_service=inviha-device-admission.service

[[ $(id -u) -eq 0 ]] || { echo 'Run as root.'; exit 1; }
[[ -f "$archive" ]] || { echo 'Release archive is missing.'; exit 1; }
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]] || { echo 'Release checksum does not match.'; exit 1; }
for path in "$backend" "$company_web" "$admin_web"; do
  [[ -d "$path" && ! -L "$path" ]] || { echo "Unexpected live directory: $path"; exit 1; }
done
systemctl is-active --quiet "$backend_service"
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-main-server-settings-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup/backend"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/google-geocoding.mjs"
node --check "$stage/backend/map-access.mjs"
grep -q 'index-H0kz7TKR.js' "$stage/company/index.html"
grep -q 'index-BVCkMlxp.js' "$stage/admin/index.html"
grep -q 'Select all' "$stage/company/assets/index-H0kz7TKR.js"
grep -q 'Main Server Settings' "$stage/admin/assets/index-BVCkMlxp.js"

cp -a "$backend/server.js" "$backup/backend/server.js"
cp -a "$backend/google-geocoding.mjs" "$backup/backend/google-geocoding.mjs"
if [[ -f "$backend/map-access.mjs" ]]; then cp -a "$backend/map-access.mjs" "$backup/backend/map-access.mjs"; fi
cp -a "$company_web" "$backup/company-live"
cp -a "$admin_web" "$backup/admin-live"
docker exec inviha-track-db pg_dump -U traccar -d inviha_app --data-only --table=platform_state > "$backup/platform-state.sql"
cp -a "$stage/company" "$company_new"
cp -a "$stage/admin" "$admin_new"

changed=0
rollback(){
  local code=$?
  trap - ERR INT TERM
  set +e
  if [[ $changed -eq 1 ]]; then
    systemctl stop "$backend_service"
    cp -a "$backup/backend/server.js" "$backend/server.js"
    cp -a "$backup/backend/google-geocoding.mjs" "$backend/google-geocoding.mjs"
    if [[ -f "$backup/backend/map-access.mjs" ]]; then cp -a "$backup/backend/map-access.mjs" "$backend/map-access.mjs"; else rm -f "$backend/map-access.mjs"; fi
    rm -rf "$company_web" "$admin_web"
    mv "$backup/company-live" "$company_web"
    mv "$backup/admin-live" "$admin_web"
    systemctl start "$backend_service"
    systemctl start "$admission_service" || true
  fi
  rm -rf "$stage" "$company_new" "$admin_new"
  echo "Deployment rolled back. Backup: $backup"
  exit "$code"
}
trap rollback ERR INT TERM

changed=1
systemctl stop "$backend_service"
install -m 0644 "$stage/backend/server.js" "$backend/server.js"
install -m 0644 "$stage/backend/google-geocoding.mjs" "$backend/google-geocoding.mjs"
install -m 0644 "$stage/backend/map-access.mjs" "$backend/map-access.mjs"
mv "$company_web" "$backup/company-original"
mv "$company_new" "$company_web"
mv "$admin_web" "$backup/admin-original"
mv "$admin_new" "$admin_web"
systemctl start "$backend_service"
systemctl start "$admission_service"

for attempt in {1..20}; do
  if curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 1
done
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const x=JSON.parse(s);if(x.ok!==true)process.exit(1)})'
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/api/public/branding | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const x=JSON.parse(s);if(!x.timeFormat||!x.dateFormat||!x.timezone||"captchaSecretKey" in x||"googleServerGeocodingKey" in x)process.exit(1)})'
systemctl is-active --quiet "$backend_service"
systemctl is-active --quiet "$admission_service"
grep -q 'index-H0kz7TKR.js' "$company_web/index.html"
grep -q 'index-BVCkMlxp.js' "$admin_web/index.html"
test -s "$company_web/assets/index-H0kz7TKR.js"
test -s "$admin_web/assets/index-BVCkMlxp.js"
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN

trap - ERR INT TERM
rm -rf "$stage"
echo "DEPLOYED main-server-settings backup=$backup"
