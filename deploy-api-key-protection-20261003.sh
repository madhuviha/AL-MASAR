#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-api-key-protection-20261003.tgz
expected_sha=97f2c57de29859930f6cffe6964d5a73c5c5aebc9865917d6dd0261822271d09
backend=/opt/inviha-backend
admin_web=/var/www/inviha/admin

[[ $(id -u) -eq 0 ]]
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]
systemctl is-active --quiet inviha-backend.service
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-api-key-protection-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup/backend"
tar -xzf "$archive" -C "$stage"
node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/google-geocoding.mjs"
grep -q 'index-CkHGZ7q7.js' "$stage/admin/index.html"
grep -q 'Deselect all' "$stage/admin/assets/index-CkHGZ7q7.js"
cp -a "$backend/server.js" "$backup/backend/server.js"
cp -a "$backend/google-geocoding.mjs" "$backup/backend/google-geocoding.mjs"
cp -a "$admin_web" "$backup/admin-live"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT data::text FROM platform_state WHERE id=1" > "$backup/platform-state-before.json"
cp -a "$stage/admin" "$admin_new"

changed=0
rollback(){
  local code=$?
  trap - ERR INT TERM
  set +e
  if [[ $changed -eq 1 ]]; then
    systemctl stop inviha-backend.service
    cp -a "$backup/backend/server.js" "$backend/server.js"
    cp -a "$backup/backend/google-geocoding.mjs" "$backend/google-geocoding.mjs"
    rm -rf "$admin_web"
    mv "$backup/admin-live" "$admin_web"
    systemctl start inviha-backend.service
    systemctl start inviha-device-admission.service || true
  fi
  rm -rf "$stage" "$admin_new"
  echo "Deployment rolled back. Backup: $backup"
  exit "$code"
}
trap rollback ERR INT TERM

changed=1
systemctl stop inviha-backend.service
install -m 0644 "$stage/backend/server.js" "$backend/server.js"
install -m 0644 "$stage/backend/google-geocoding.mjs" "$backend/google-geocoding.mjs"
mv "$admin_web" "$backup/admin-original"
mv "$admin_new" "$admin_web"
systemctl start inviha-backend.service
systemctl start inviha-device-admission.service
ready=0
for attempt in {1..20}; do
  if curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready -eq 1 ]]
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null
grep -q 'index-CkHGZ7q7.js' "$admin_web/index.html"
systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN

trap - ERR INT TERM
rm -rf "$stage"
echo "DEPLOYED api-key-protection backup=$backup"
