#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-login-branding-20261002.tgz
expected_sha=ee2162639403c5a42b854f89d3956c511fe01340c7cda3aa492c8b2c2321a266
actual_sha=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_sha" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-login-branding-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
grep -q 'index-VNOUbYjQ.js' "$stage/company/index.html"
grep -q 'index-kJzYsBmR.js' "$stage/admin/index.html"

cp -a /opt/inviha-backend/server.js "$backup/server.js"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT data::text FROM platform_state WHERE id=1" > "$backup/platform-state-before.json"
cp -a "$stage/company" "$company_new"
cp -a "$stage/admin" "$admin_new"

rollback() {
  cp -a "$backup/server.js" /opt/inviha-backend/server.js
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
install -m 0644 "$stage/backend/server.js" /opt/inviha-backend/server.js

docker exec inviha-track-db psql -U traccar -d inviha_app -c "UPDATE platform_state SET data=jsonb_set(COALESCE(data,'{}'::jsonb),'{settings}',COALESCE(data->'settings','{}'::jsonb) || CASE WHEN COALESCE(data->'settings','{}'::jsonb) ? 'loginPanelTransparency' THEN '{}'::jsonb ELSE '{\"loginPanelTransparency\":18}'::jsonb END,true) WHERE id=1"

systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service

for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null && ss -lntH 'sport = :5023' | grep -q LISTEN && ss -lntH 'sport = :5027' | grep -q LISTEN; then break; fi
  sleep 1
done

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
grep -q 'index-VNOUbYjQ.js' /var/www/inviha/company/index.html
grep -q 'index-kJzYsBmR.js' /var/www/inviha/admin/index.html
branding=$(curl -fsS http://127.0.0.1:3001/api/public/branding)
grep -q '"loginPanelTransparency"' <<< "$branding"
grep -q '"loginBackgroundData":""' <<< "$branding"
status=$(curl -sS -o /tmp/inviha-login-background-check -w '%{http_code}' http://127.0.0.1:3001/api/public/login-background)
[[ "$status" == "200" || "$status" == "204" ]]
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'loginPanelTransparency','') FROM platform_state WHERE id=1" | grep -Eq '^[0-9]+$'
ss -lntH 'sport = :5023' | grep LISTEN
ss -lntH 'sport = :5027' | grep LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED backup=$backup background_status=$status"
