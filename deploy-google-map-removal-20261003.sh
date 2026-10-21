#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-google-map-removal-20261003.tgz
expected_sha=80ae928ebb5382e6ee0a702715d55620a313401a7d27df84360912940a2e508b
backend=/opt/inviha-backend
company_web=/var/www/inviha/company
admin_web=/var/www/inviha/admin
backend_service=inviha-backend.service
admission_service=inviha-device-admission.service

[[ $(id -u) -eq 0 ]]
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]
for path in "$backend" "$company_web" "$admin_web"; do
  [[ -d "$path" && ! -L "$path" ]]
done
systemctl is-active --quiet "$backend_service"
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-google-map-removal-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup/backend"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/google-geocoding.mjs"
node --check "$stage/backend/map-access.mjs"
grep -q 'index-CNovXAYU.js' "$stage/company/index.html"
grep -q 'index-rP8DpS-n.js' "$stage/admin/index.html"
! grep -R -q 'maps.googleapis.com/maps/api/js' "$stage/company/assets" "$stage/admin/assets"
! grep -R -q 'Google Maps browser key' "$stage/admin/assets"
! grep -R -q 'Google Geocoding key' "$stage/admin/assets"

cp -a "$backend/server.js" "$backup/backend/server.js"
cp -a "$backend/google-geocoding.mjs" "$backup/backend/google-geocoding.mjs"
cp -a "$backend/map-access.mjs" "$backup/backend/map-access.mjs"
cp -a "$company_web" "$backup/company-live"
cp -a "$admin_web" "$backup/admin-live"
docker exec inviha-track-db pg_dump -U traccar -d inviha_app -Fc > "$backup/inviha-app-before.dump"
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
    cp -a "$backup/backend/map-access.mjs" "$backend/map-access.mjs"
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

ready=0
for attempt in {1..20}; do
  if curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready -eq 1 ]]
docker exec -i inviha-track-db psql -v ON_ERROR_STOP=1 -U traccar -d inviha_app < "$stage/remove-google-settings.sql"

curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null
systemctl is-active --quiet "$backend_service"
systemctl is-active --quiet "$admission_service"
grep -q 'index-CNovXAYU.js' "$company_web/index.html"
grep -q 'index-rP8DpS-n.js' "$admin_web/index.html"
test -s "$company_web/assets/index-CNovXAYU.js"
test -s "$admin_web/assets/index-rP8DpS-n.js"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT CASE WHEN data->'settings'->>'geocoderPrimary'='nominatim' AND data->'settings'->>'mapProvider'='OpenStreetMap' AND NOT (data->'settings' ? 'googleMapsKey') AND NOT (data->'settings' ? 'googleServerGeocodingKey') THEN 'ok' ELSE 'failed' END FROM platform_state WHERE id=1" | grep -qx ok
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN

trap - ERR INT TERM
rm -rf "$stage"
echo "DEPLOYED google-map-removal backup=$backup"
