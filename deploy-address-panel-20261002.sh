#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-address-panel-20261002.tgz
expected_sha=8d32190adb6001527a54c0826905afc61f417ab8604f58b030a8bdda35aeac25
actual_sha=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_sha" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-address-panel-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"

node --check "$stage/backend/google-geocoding.mjs"
test -s "$stage/company/index.html"
test -s "$stage/admin/index.html"

cp -a /opt/inviha-backend/google-geocoding.mjs "$backup/google-geocoding.mjs"
cp -a "$stage/company" "$company_new"
cp -a "$stage/admin" "$admin_new"

rollback() {
  cp -a "$backup/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
  if [[ -d "$backup/company-live" ]]; then rm -rf /var/www/inviha/company; mv "$backup/company-live" /var/www/inviha/company; fi
  if [[ -d "$backup/admin-live" ]]; then rm -rf /var/www/inviha/admin; mv "$backup/admin-live" /var/www/inviha/admin; fi
  systemctl restart inviha-backend.service || true
  systemctl start inviha-device-admission.service || true
}
trap rollback ERR

mv /var/www/inviha/company "$backup/company-live"
mv "$company_new" /var/www/inviha/company
mv /var/www/inviha/admin "$backup/admin-live"
mv "$admin_new" /var/www/inviha/admin
install -m 0644 "$stage/backend/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs

docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT coordinate_key || E'\\t' || address || E'\\t' || provider || E'\\t' || updated_at FROM reverse_geocode_cache WHERE address ~* '^(Bus Stop|Bus Station|Metro Station|Train Station)'" > "$backup/removed-transit-addresses.tsv"
docker exec inviha-track-db psql -U traccar -d inviha_app -c "DELETE FROM reverse_geocode_cache WHERE address ~* '^(Bus Stop|Bus Station|Metro Station|Train Station)'"

systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service

for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null && ss -lntH 'sport = :5023' | grep -q LISTEN && ss -lntH 'sport = :5027' | grep -q LISTEN; then break; fi
  sleep 1
done

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
grep -q 'index-CeZsc0t8.js' /var/www/inviha/company/index.html
grep -q 'index-CU82APN9.js' /var/www/inviha/admin/index.html
ss -lntH 'sport = :5023' | grep LISTEN
ss -lntH 'sport = :5027' | grep LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED backup=$backup"
