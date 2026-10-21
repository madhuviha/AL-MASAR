#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-address-no-store-20261002.tgz
expected_sha=630996c301543e093e9c3e9febc5ae8486aed2534f41e0ce5250b7d4162cbc32
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-address-no-store-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/google-geocoding.mjs"
grep -q 'index-DCvBkqGi.js' "$stage/company/index.html"
grep -q 'no-store' "$stage/company/assets/index-DCvBkqGi.js"
grep -q 'private,no-store' "$stage/backend/server.js"

cp -a /opt/inviha-backend/server.js "$backup/server.js"
cp -a /opt/inviha-backend/google-geocoding.mjs "$backup/google-geocoding.mjs"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc \
  "SELECT coordinate_key||E'\\t'||address||E'\\t'||provider||E'\\t'||updated_at FROM reverse_geocode_cache WHERE coordinate_key='25.2167,51.4291'" \
  > "$backup/address-cache-before.tsv"
cp -a "$stage/company" "$company_new"

rollback(){
  cp -a "$backup/server.js" /opt/inviha-backend/server.js
  cp -a "$backup/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
  if [[ -d "$backup/company-live" ]]; then
    rm -rf /var/www/inviha/company
    mv "$backup/company-live" /var/www/inviha/company
  fi
  systemctl restart inviha-backend.service || true
  systemctl start inviha-device-admission.service || true
}
trap rollback ERR

mv /var/www/inviha/company "$backup/company-live"
mv "$company_new" /var/www/inviha/company
install -m 0644 "$stage/backend/server.js" /opt/inviha-backend/server.js
install -m 0644 "$stage/backend/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service

for attempt in {1..20}; do
  curl -fsS http://127.0.0.1:3001/health >/dev/null && break
  sleep 1
done

validation=$(cd /opt/inviha-backend && node --input-type=module <<'NODE'
import dotenv from 'dotenv';
import pg from 'pg';
import axios from 'axios';
import {bestGoogleAddress,createGoogleGeocoder,geocodeCacheKey} from './google-geocoding.mjs';

dotenv.config();
const {Pool}=pg;
const appPool=new Pool({connectionString:process.env.DATABASE_URL});
const livePool=new Pool({connectionString:process.env.TRACCAR_DATABASE_URL});
try {
  const key=(await appPool.query("SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') AS key FROM platform_state WHERE id=1")).rows[0].key;
  if (!key) throw Error('google_server_key_missing');
  const fixed={latitude:25.2167,longitude:51.4291};
  const response=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{
    params:{latlng:`${fixed.latitude},${fixed.longitude}`,language:'en',region:'qa',key},
    timeout:10000
  });
  if(response.data?.status!=='OK') throw Error('google_'+response.data?.status);
  const selected=bestGoogleAddress(response.data.results||[]);
  if(selected!=='Street 1, Industrial Area, Ar Rayyan, Qatar') throw Error('unexpected_fixed_address:'+selected);
  const geocoder=createGoogleGeocoder({pool:appPool,http:axios});
  const fixedKey=geocodeCacheKey(fixed.latitude,fixed.longitude);
  await appPool.query('DELETE FROM reverse_geocode_cache WHERE coordinate_key=$1',[fixedKey]);
  await geocoder.save(fixed.latitude,fixed.longitude,selected,'google-server');

  const current=(await livePool.query("SELECT p.latitude,p.longitude FROM tc_devices d JOIN tc_positions p ON p.id=d.positionid WHERE d.uniqueid=$1",['353201357052585'])).rows[0];
  let currentAddress='position_missing';
  if(current){
    const currentKey=geocodeCacheKey(current.latitude,current.longitude);
    if(currentKey===fixedKey){
      currentAddress=selected;
    }else{
      await appPool.query('DELETE FROM reverse_geocode_cache WHERE coordinate_key=$1',[currentKey]);
      currentAddress=await geocoder.reverse(current.latitude,current.longitude);
    }
  }
  const saved=(await appPool.query('SELECT address,provider FROM reverse_geocode_cache WHERE coordinate_key=$1',[fixedKey])).rows[0];
  if(saved?.address!==selected) throw Error('fixed_cache_not_saved');
  console.log(`fixed=${selected} | current=${currentAddress} | cache=${saved.provider}`);
} finally {
  await appPool.end();
  await livePool.end();
}
NODE
)

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
grep -q 'index-DCvBkqGi.js' /var/www/inviha/company/index.html
test -s /var/www/inviha/company/assets/index-DCvBkqGi.js
grep -q 'private,no-store' /opt/inviha-backend/server.js
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED $validation backup=$backup"
