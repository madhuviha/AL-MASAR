#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-english-map-20261002.tgz
expected_sha=0ae1f091099a2a796a53ecb235f32d989680d4c873bf58fc3f7ede878d0df335
actual_sha=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_sha" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-english-map-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
node --input-type=module --check < "$stage/backend/map-access.mjs"
grep -q 'index-C_YEzJBt.js' "$stage/company/index.html"

cp -a /opt/inviha-backend/server.js /opt/inviha-backend/map-access.mjs "$backup/"
cp -a "$stage/company" "$company_new"

rollback() {
  cp -a "$backup/server.js" "$backup/map-access.mjs" /opt/inviha-backend/
  if [[ -d "$backup/company-live" ]]; then rm -rf /var/www/inviha/company; mv "$backup/company-live" /var/www/inviha/company; fi
  systemctl restart inviha-backend.service || true
  systemctl start inviha-device-admission.service || true
}
trap rollback ERR

mv /var/www/inviha/company "$backup/company-live"
mv "$company_new" /var/www/inviha/company
install -m 0644 "$stage/backend/server.js" /opt/inviha-backend/server.js
install -m 0644 "$stage/backend/map-access.mjs" /opt/inviha-backend/map-access.mjs

docker exec inviha-track-db psql -U traccar -d inviha_app -c "UPDATE auth_users u SET metadata=COALESCE(u.metadata,'{}'::jsonb)||jsonb_build_object('defaultBaseMap','google-road','mapAccess',COALESCE(u.metadata->'mapAccess','{}'::jsonb)||'{\"googleRoad\":true}'::jsonb) FROM companies c WHERE c.id=u.company_id AND upper(c.name)=upper('AL MASAR')"

systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service

for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null && ss -lntH 'sport = :5023' | grep -q LISTEN && ss -lntH 'sport = :5027' | grep -q LISTEN; then break; fi
  sleep 1
done

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
grep -q 'index-C_YEzJBt.js' /var/www/inviha/company/index.html
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT count(*) FROM auth_users u JOIN companies c ON c.id=u.company_id WHERE upper(c.name)=upper('AL MASAR') AND u.metadata->>'defaultBaseMap'='google-road' AND u.metadata->'mapAccess'->>'googleRoad'='true'" | grep -Eq '^[1-9][0-9]*$'
ss -lntH 'sport = :5023' | grep LISTEN
ss -lntH 'sport = :5027' | grep LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED backup=$backup"
