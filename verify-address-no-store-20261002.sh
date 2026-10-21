#!/usr/bin/env bash
set -Eeuo pipefail
systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
test -s /var/www/inviha/company/assets/index-DCvBkqGi.js
grep -q 'no-store' /var/www/inviha/company/assets/index-DCvBkqGi.js
grep -q 'private,no-store' /opt/inviha-backend/server.js
address=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT address FROM reverse_geocode_cache WHERE coordinate_key='25.2167,51.4291'")
[[ "$address" == 'Street 1, Industrial Area, Ar Rayyan, Qatar' ]]
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN
echo "services=active health=ok frontend=no-store backend=no-store ports=5023,5027 address=$address"
