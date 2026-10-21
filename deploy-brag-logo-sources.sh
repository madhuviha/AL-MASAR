#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

stage=/tmp/inviha-brag-logo-sources
backend=/opt/inviha-backend
admin=/var/www/inviha/admin
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
rollback=/var/backups/inviha-brag-logo-sources-$stamp
changed=0

test -f "$stage/backend/server.js"
test -f "$stage/backend/brag-report.mjs"
test -f "$stage/admin/index.html"
admin_bundle="$(grep -o 'assets/index-[^"]*\.js' "$stage/admin/index.html" | head -n1)"
test -n "$admin_bundle"
test -f "$stage/admin/$admin_bundle"
grep -q 'Automatic' "$stage/admin/$admin_bundle"
grep -q 'logoModes' "$stage/backend/brag-report.mjs"
grep -q 'companyProfile.logoData' "$stage/backend/server.js"
node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/brag-report.mjs"
systemctl is-active --quiet inviha-backend
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
nginx -t

install -d -m 0700 "$rollback/backend" "$rollback/admin"
cp -a "$backend/server.js" "$backend/brag-report.mjs" "$rollback/backend/"
cp -a "$admin/." "$rollback/admin/"

restore(){
  code=$?
  trap - ERR INT TERM
  set +e
  if [[ "$changed" -eq 1 ]]; then
    cp -a "$rollback/backend/." "$backend/"
    cp -a "$rollback/admin/." "$admin/"
    chown -R www-data:www-data "$admin"
    systemctl restart inviha-backend
    nginx -t && systemctl reload nginx
  fi
  echo "Deployment rolled back: $rollback" >&2
  exit "$code"
}
trap restore ERR INT TERM

changed=1
install -m 0644 "$stage/backend/server.js" "$backend/server.js"
install -m 0644 "$stage/backend/brag-report.mjs" "$backend/brag-report.mjs"
systemctl restart inviha-backend
for attempt in {1..25}; do
  if systemctl is-active --quiet inviha-backend && curl --fail --silent --max-time 4 http://127.0.0.1:3001/health >/dev/null; then break; fi
  sleep 1
done
systemctl is-active --quiet inviha-backend
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:3001/api/report-settings)" = "401"
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3001/api/reports/brag)" = "401"

cp -a "$stage/admin/assets/." "$admin/assets/"
chown -R www-data:www-data "$admin/assets"
install -m 0644 "$stage/admin/index.html" "$admin/.index-logo-$stamp"
chown www-data:www-data "$admin/.index-logo-$stamp"
mv -f "$admin/.index-logo-$stamp" "$admin/index.html"
nginx -t
systemctl reload nginx

grep -q "$admin_bundle" "$admin/index.html"
curl --noproxy '*' --resolve admin.inviha.com:443:127.0.0.1 --fail --silent --show-error --max-time 10 https://admin.inviha.com/admin/ | grep -q "$admin_bundle"
grep -q 'Automatic' "$admin/$admin_bundle"

trap - ERR INT TERM
echo "BRAG_LOGO_SOURCES_DEPLOYED admin=$admin_bundle rollback=$rollback"
