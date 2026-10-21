#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

stage=/tmp/inviha-expired-vehicle-access
backend=/opt/inviha-backend
company=/var/www/inviha/company
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
rollback=/var/backups/inviha-expired-vehicle-access-$stamp
changed=0

for file in server.js device-profiles.mjs; do test -f "$stage/backend/$file"; done
test -f "$stage/company/index.html"
company_bundle="$(grep -o 'assets/index-[^"]*\.js' "$stage/company/index.html" | head -n1)"
test -n "$company_bundle"
test -f "$stage/company/$company_bundle"
grep -q 'Please renew' "$stage/company/$company_bundle"
grep -q 'vehicle_expired' "$stage/backend/server.js"
grep -q 'live_access:false' "$stage/backend/server.js"
node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/device-profiles.mjs"
systemctl is-active --quiet inviha-backend
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
nginx -t

install -d -m 0700 "$rollback/backend" "$rollback/company"
cp -a "$backend/server.js" "$backend/device-profiles.mjs" "$rollback/backend/"
cp -a "$company/." "$rollback/company/"

restore(){
  code=$?
  trap - ERR INT TERM
  set +e
  if [[ "$changed" -eq 1 ]]; then
    cp -a "$rollback/backend/." "$backend/"
    cp -a "$rollback/company/." "$company/"
    chown -R www-data:www-data "$company"
    systemctl restart inviha-backend
    nginx -t && systemctl reload nginx
  fi
  echo "Deployment rolled back: $rollback" >&2
  exit "$code"
}
trap restore ERR INT TERM

changed=1
install -m 0644 "$stage/backend/server.js" "$backend/server.js"
install -m 0644 "$stage/backend/device-profiles.mjs" "$backend/device-profiles.mjs"
systemctl restart inviha-backend
for attempt in {1..25}; do
  if systemctl is-active --quiet inviha-backend && curl --fail --silent --max-time 4 http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 1
done
systemctl is-active --quiet inviha-backend
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:3001/api/vehicles)" = "401"

cp -a "$stage/company/assets/." "$company/assets/"
chown -R www-data:www-data "$company/assets"
install -m 0644 "$stage/company/index.html" "$company/.index-expiry-$stamp"
chown www-data:www-data "$company/.index-expiry-$stamp"
mv -f "$company/.index-expiry-$stamp" "$company/index.html"
nginx -t
systemctl reload nginx

grep -q "$company_bundle" "$company/index.html"
curl --noproxy '*' --resolve track.inviha.com:443:127.0.0.1 --fail --silent --show-error --max-time 10 https://track.inviha.com/ | grep -q "$company_bundle"
grep -q 'Please renew' "$company/$company_bundle"
grep -q 'vehicle_expired' "$backend/server.js"

trap - ERR INT TERM
echo "EXPIRED_VEHICLE_ACCESS_DEPLOYED company=$company_bundle rollback=$rollback"
