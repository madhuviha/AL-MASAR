#!/usr/bin/env bash
set -Eeuo pipefail
archive=/tmp/inviha-area-components-20261002.tgz
expected_sha=d95aa9586e3d00c3409468ce35a3f0281fa53d03e2fdc79f13b734d65b62e551
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]
stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-area-components-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"
node --check "$stage/backend/google-geocoding.mjs"
grep -q 'index-B_zesKMf.js' "$stage/company/index.html"
cp -a /opt/inviha-backend/google-geocoding.mjs "$backup/google-geocoding.mjs"
cp -a "$stage/company" "$company_new"
rollback(){
 cp -a "$backup/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
 if [[ -d "$backup/company-live" ]]; then rm -rf /var/www/inviha/company; mv "$backup/company-live" /var/www/inviha/company; fi
 systemctl restart inviha-backend.service || true
 systemctl start inviha-device-admission.service || true
}
trap rollback ERR
mv /var/www/inviha/company "$backup/company-live"
mv "$company_new" /var/www/inviha/company
install -m 0644 "$stage/backend/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service
for attempt in {1..20}; do curl -fsS http://127.0.0.1:3001/health >/dev/null && break; sleep 1; done
address=$(cd /opt/inviha-backend && node --input-type=module <<'NODE'
import dotenv from 'dotenv';import pg from 'pg';import axios from 'axios';import {createGoogleGeocoder,geocodeCacheKey} from './google-geocoding.mjs';
dotenv.config();const {Pool}=pg;const appPool=new Pool({connectionString:process.env.DATABASE_URL}),livePool=new Pool({connectionString:process.env.TRACCAR_DATABASE_URL});
try{const row=(await livePool.query('SELECT latitude,longitude FROM tc_positions WHERE deviceid=$1 ORDER BY id DESC LIMIT 1',[4])).rows[0];if(!row)throw Error('position_missing');const key=geocodeCacheKey(row.latitude,row.longitude);await appPool.query('DELETE FROM reverse_geocode_cache WHERE coordinate_key=$1',[key]);const address=await createGoogleGeocoder({pool:appPool,http:axios}).reverse(row.latitude,row.longitude);console.log(address)}finally{await appPool.end();await livePool.end()}
NODE
)
[[ "$address" == *,*Qatar* && "$address" != "Doha, Qatar" ]]
systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
grep -q 'index-B_zesKMf.js' /var/www/inviha/company/index.html
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN
trap - ERR
rm -rf "$stage"
echo "DEPLOYED address=$address backup=$backup"
