#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source_backup=/var/backups/inviha-google-map-removal-20261003T190119Z
backend=/opt/inviha-backend
company_web=/var/www/inviha/company
admin_web=/var/www/inviha/admin
backend_service=inviha-backend.service
admission_service=inviha-device-admission.service
temp_db=inviha_google_restore_tmp

[[ $(id -u) -eq 0 ]]
[[ -s "$source_backup/inviha-app-before.dump" ]]
for path in "$source_backup/backend" "$source_backup/company-original" "$source_backup/admin-original"; do
  [[ -d "$path" && ! -L "$path" ]]
done
systemctl is-active --quiet "$backend_service"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-google-map-restoration-$stamp"
company_restore="/var/www/inviha/company.restore-$stamp"
admin_restore="/var/www/inviha/admin.restore-$stamp"
restore_sql=/tmp/inviha-google-restore-state.sql
mkdir -p "$backup/backend"
cp -a "$backend/server.js" "$backup/backend/server.js"
cp -a "$backend/google-geocoding.mjs" "$backup/backend/google-geocoding.mjs"
cp -a "$backend/map-access.mjs" "$backup/backend/map-access.mjs"
cp -a "$company_web" "$backup/company-live"
cp -a "$admin_web" "$backup/admin-live"
docker exec inviha-track-db pg_dump -U traccar -d inviha_app -Fc > "$backup/inviha-app-google-removed.dump"

docker exec inviha-track-db dropdb -U traccar --if-exists "$temp_db"
docker exec inviha-track-db createdb -U traccar "$temp_db"
docker exec -i inviha-track-db pg_restore -U traccar -d "$temp_db" --no-owner --no-privileges < "$source_backup/inviha-app-before.dump"
{
  echo 'BEGIN;'
  docker exec inviha-track-db psql -U traccar -d "$temp_db" -Atc "SELECT format('UPDATE platform_state SET data=%L::jsonb, version=%s, updated_at=%L::timestamptz WHERE id=%s;', data::text, version, updated_at, id) FROM platform_state"
  docker exec inviha-track-db psql -U traccar -d "$temp_db" -Atc "SELECT format('UPDATE auth_users SET metadata=%L::jsonb WHERE id=%L;', COALESCE(metadata,'{}'::jsonb)::text, id) FROM auth_users"
  echo 'COMMIT;'
} > "$restore_sql"
chmod 600 "$restore_sql"
cp -a "$source_backup/company-original" "$company_restore"
cp -a "$source_backup/admin-original" "$admin_restore"

node --input-type=module --check < "$source_backup/backend/server.js"
node --check "$source_backup/backend/google-geocoding.mjs"
node --check "$source_backup/backend/map-access.mjs"
grep -R -q 'maps.googleapis.com/maps/api/js' "$company_restore/assets"
grep -R -q 'Google Maps browser key' "$admin_restore/assets"

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
  docker exec inviha-track-db dropdb -U traccar --if-exists "$temp_db" >/dev/null 2>&1 || true
  rm -rf "$company_restore" "$admin_restore"
  rm -f "$restore_sql"
  echo "Google Maps restoration rolled back. Backup: $backup"
  exit "$code"
}
trap rollback ERR INT TERM

changed=1
systemctl stop "$backend_service"
install -m 0644 "$source_backup/backend/server.js" "$backend/server.js"
install -m 0644 "$source_backup/backend/google-geocoding.mjs" "$backend/google-geocoding.mjs"
install -m 0644 "$source_backup/backend/map-access.mjs" "$backend/map-access.mjs"
rm -rf "$company_web" "$admin_web"
mv "$company_restore" "$company_web"
mv "$admin_restore" "$admin_web"
docker exec -i inviha-track-db psql -v ON_ERROR_STOP=1 -U traccar -d inviha_app < "$restore_sql"
systemctl start "$backend_service"
systemctl start "$admission_service"

ready=0
for attempt in {1..20}; do
  if curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready -eq 1 ]]
systemctl is-active --quiet "$backend_service"
systemctl is-active --quiet "$admission_service"
grep -R -q 'maps.googleapis.com/maps/api/js' "$company_web/assets"
grep -R -q 'Google Maps browser key' "$admin_web/assets"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT CASE WHEN length(COALESCE(data->'settings'->>'googleMapsKey',''))>0 THEN 'ok' ELSE 'missing' END FROM platform_state WHERE id=1" | grep -qx ok
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN

trap - ERR INT TERM
docker exec inviha-track-db dropdb -U traccar --if-exists "$temp_db" >/dev/null
rm -f "$restore_sql"
echo "RESTORED google-maps backup=$backup"
