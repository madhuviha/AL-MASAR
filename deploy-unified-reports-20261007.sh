#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

archive="${1:-/tmp/inviha-unified-reports-20261007.tgz}"
backend=/opt/inviha-backend
company=/var/www/inviha/company
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
stage="$(mktemp -d /tmp/inviha-unified-reports-XXXXXX)"
backup="/var/backups/inviha-unified-reports-${stamp}"
changed=0

test -f "$archive"
tar -xzf "$archive" -C "$stage"
release="$stage/release"
for file in report-normalization.mjs report-engine.mjs scheduler.mjs; do
  test -f "$release/backend/$file"
  node --check "$release/backend/$file"
done
test -f "$release/company/index.html"
test -d "$release/company/assets"
company_bundle="$(grep -o 'assets/index-[^"]*\.js' "$release/company/index.html" | head -n1)"
company_css="$(grep -o 'assets/index-[^"]*\.css' "$release/company/index.html" | head -n1)"
test -n "$company_bundle"
test -n "$company_css"
test -f "$release/company/$company_bundle"
test -f "$release/company/$company_css"
grep -q 'General Report' "$release/company/$company_bundle"
grep -q 'Geofence Alert Report' "$release/company/$company_bundle"
grep -q 'Fuel changes' "$release/company/$company_bundle"
grep -q 'Door transitions' "$release/company/$company_bundle"
grep -q 'No recorded data matches the selected vehicles and period' "$release/company/$company_bundle"
grep -q 'fleetReportEmpty' "$release/company/$company_css"
grep -q 'bragCompanyIdentity' "$release/company/$company_css"

systemctl is-active --quiet inviha-backend
curl --noproxy '*' --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
nginx -t
port5023_before=0
port5027_before=0
ss -lntH 'sport = :5023' | grep -q LISTEN && port5023_before=1 || true
ss -lntH 'sport = :5027' | grep -q LISTEN && port5027_before=1 || true

install -d -m 0700 "$backup/backend" "$backup/company"
for file in report-normalization.mjs report-engine.mjs scheduler.mjs; do
  if test -f "$backend/$file"; then
    cp -a "$backend/$file" "$backup/backend/$file"
  else
    touch "$backup/backend/.missing-$file"
  fi
done
cp -a "$company/." "$backup/company/"

rollback(){
  code=$?
  trap - ERR INT TERM
  set +e
  if [[ "$changed" -eq 1 ]]; then
    for file in report-normalization.mjs report-engine.mjs scheduler.mjs; do
      if test -f "$backup/backend/.missing-$file"; then
        rm -f "$backend/$file"
      else
        cp -a "$backup/backend/$file" "$backend/$file"
      fi
    done
    cp -a "$backup/company/." "$company/"
    chown -R www-data:www-data "$company"
    systemctl restart inviha-backend
    nginx -t && systemctl reload nginx
  fi
  echo "Deployment rolled back. Backup: $backup" >&2
  exit "$code"
}
trap rollback ERR INT TERM

changed=1
for file in report-normalization.mjs report-engine.mjs scheduler.mjs; do
  install -m 0644 "$release/backend/$file" "$backend/$file"
done
systemctl restart inviha-backend
for attempt in {1..25}; do
  if systemctl is-active --quiet inviha-backend && curl --noproxy '*' --fail --silent --max-time 4 http://127.0.0.1:3001/health >/dev/null; then
    break
  fi
  sleep 1
done
systemctl is-active --quiet inviha-backend
curl --noproxy '*' --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
if [[ "$port5023_before" -eq 1 ]]; then ss -lntH 'sport = :5023' | grep -q LISTEN; fi
if [[ "$port5027_before" -eq 1 ]]; then ss -lntH 'sport = :5027' | grep -q LISTEN; fi

cp -a "$release/company/assets/." "$company/assets/"
chown -R www-data:www-data "$company/assets"
install -m 0644 "$release/company/index.html" "$company/.index-reports-$stamp"
chown www-data:www-data "$company/.index-reports-$stamp"
mv -f "$company/.index-reports-$stamp" "$company/index.html"
nginx -t
systemctl reload nginx

grep -q "$company_bundle" "$company/index.html"
grep -q 'Fuel changes' "$company/$company_bundle"
grep -q 'fleetReportEmpty' "$company/$company_css"
curl --noproxy '*' --resolve track.inviha.com:443:127.0.0.1 --fail --silent --show-error --max-time 10 https://track.inviha.com/ | grep -q "$company_bundle"

trap - ERR INT TERM
echo "UNIFIED_REPORTS_DEPLOYED"
echo "BACKUP=$backup"
echo "JS=$company_bundle"
echo "CSS=$company_css"
echo "BACKEND_HEALTH=$(curl --noproxy '*' --fail --silent --max-time 5 http://127.0.0.1:3001/health)"
