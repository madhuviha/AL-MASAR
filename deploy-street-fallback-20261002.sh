#!/usr/bin/env bash
set -Eeuo pipefail
archive=/tmp/inviha-street-fallback-20261002.tgz
expected_sha=f7898a89eb8092d54bdcf5d94e8f145a57e3c90b816252bb7fddb456ef02912d
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]
stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-street-fallback-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"
node --check "$stage/backend/google-geocoding.mjs"
grep -q 'index-CTyaqJ6R.js' "$stage/company/index.html"
cp -a /opt/inviha-backend/google-geocoding.mjs "$backup/google-geocoding.mjs"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT coordinate_key||E'\\t'||address||E'\\t'||provider||E'\\t'||updated_at FROM reverse_geocode_cache WHERE coordinate_key='25.2167,51.4291'" > "$backup/address-cache-before.tsv"
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
validation=$(cd /opt/inviha-backend && node --input-type=module <<'NODE'
import dotenv from 'dotenv';import pg from 'pg';import axios from 'axios';import {bestGoogleAddress,createGoogleGeocoder,geocodeCacheKey} from './google-geocoding.mjs';
dotenv.config();const {Pool}=pg;const appPool=new Pool({connectionString:process.env.DATABASE_URL}),livePool=new Pool({connectionString:process.env.TRACCAR_DATABASE_URL});
try{const key=(await appPool.query("SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') AS key FROM platform_state WHERE id=1")).rows[0].key;const fixed={latitude:25.2167,longitude:51.4291};const response=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{params:{latlng:`${fixed.latitude},${fixed.longitude}`,language:'en',region:'qa',key},timeout:10000});if(response.data?.status!=='OK')throw Error('google_'+response.data?.status);const selected=bestGoogleAddress(response.data.results||[]);if(!selected.includes('Street 1'))throw Error('street_fallback_failed:'+selected);const geocoder=createGoogleGeocoder({pool:appPool,http:axios});await appPool.query('DELETE FROM reverse_geocode_cache WHERE coordinate_key=$1',[geocodeCacheKey(fixed.latitude,fixed.longitude)]);await geocoder.save(fixed.latitude,fixed.longitude,selected,'google-server');const current=(await livePool.query('SELECT latitude,longitude FROM tc_positions WHERE deviceid=$1 ORDER BY id DESC LIMIT 1',[4])).rows[0];let currentAddress='position_missing';if(current){const currentKey=geocodeCacheKey(current.latitude,current.longitude);await appPool.query('DELETE FROM reverse_geocode_cache WHERE coordinate_key=$1',[currentKey]);currentAddress=await geocoder.reverse(current.latitude,current.longitude)}console.log(`fixed=${selected} | current=${currentAddress}`)}finally{await appPool.end();await livePool.end()}
NODE
)
systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
grep -q 'index-CTyaqJ6R.js' /var/www/inviha/company/index.html
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN
trap - ERR
rm -rf "$stage"
echo "DEPLOYED $validation backup=$backup"