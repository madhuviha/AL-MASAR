#!/usr/bin/env bash
set -Eeuo pipefail
key=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleMapsKey','') FROM platform_state WHERE id=1")
coords=$(docker exec inviha-track-db psql -U traccar -d traccar -Atc "SELECT latitude||','||longitude FROM tc_positions WHERE deviceid=4 ORDER BY id DESC LIMIT 1")
config=$(mktemp)
response=$(mktemp)
trap 'rm -f "$config" "$response"' EXIT
chmod 600 "$config"
printf 'url = "https://maps.googleapis.com/maps/api/geocode/json"\nget\ndata-urlencode = "latlng=%s"\ndata-urlencode = "language=en"\ndata-urlencode = "region=qa"\ndata-urlencode = "key=%s"\n' "$coords" "$key" > "$config"
curl -fsS --config "$config" -o "$response"
python3 - "$response" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
print('google_status='+str(data.get('status','')))
print('result_count='+str(len(data.get('results') or [])))
for row in (data.get('results') or [])[:3]: print('result='+str(row.get('formatted_address','')))
if data.get('error_message'): print('error_message='+str(data['error_message']))
PY