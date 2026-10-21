#!/usr/bin/env bash
set -Eeuo pipefail
source_backup=$(find /var/backups -maxdepth 1 -type d -name 'inviha-login-branding-*' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-map-key-placement-$stamp"
mkdir -p "$backup"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT data::text FROM platform_state WHERE id=1" > "$backup/platform-state-before.json"
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT coordinate_key||E'\\t'||address||E'\\t'||provider||E'\\t'||updated_at FROM reverse_geocode_cache WHERE lower(trim(address)) IN ('doha, qatar','qatar')" > "$backup/coarse-address-cache.tsv"
current_browser=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleMapsKey','') FROM platform_state WHERE id=1")
current_server=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') FROM platform_state WHERE id=1")
old_browser=$(python3 - "$source_backup/platform-state-before.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
print(data.get('settings',{}).get('googleMapsKey',''))
PY
)
[[ "$current_browser" =~ ^[A-Za-z0-9_-]{30,100}$ ]]
[[ "$old_browser" =~ ^[A-Za-z0-9_-]{30,100}$ ]]
[[ -z "$current_server" ]]
[[ "$current_browser" != "$old_browser" ]]
docker exec -i inviha-track-db psql -v ON_ERROR_STOP=1 -U traccar -d inviha_app >/dev/null <<SQL
BEGIN;
UPDATE platform_state
SET data=jsonb_set(
  jsonb_set(data,'{settings,googleMapsKey}',to_jsonb('$old_browser'::text),true),
  '{settings,googleServerGeocodingKey}',to_jsonb('$current_browser'::text),true
), version=version+1, updated_at=NOW()
WHERE id=1;
DELETE FROM reverse_geocode_cache WHERE lower(trim(address)) IN ('doha, qatar','qatar');
COMMIT;
SQL
systemctl restart inviha-backend.service
for attempt in {1..20}; do curl -fsS http://127.0.0.1:3001/health >/dev/null && break; sleep 1; done
systemctl is-active --quiet inviha-backend.service
browser_len=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT length(COALESCE(data->'settings'->>'googleMapsKey','')) FROM platform_state WHERE id=1")
server_len=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT length(COALESCE(data->'settings'->>'googleServerGeocodingKey','')) FROM platform_state WHERE id=1")
[[ "$browser_len" -gt 30 && "$server_len" -gt 30 ]]
curl -fsS http://127.0.0.1:3001/health
ss -lntH 'sport = :5023' | grep -q LISTEN
ss -lntH 'sport = :5027' | grep -q LISTEN
echo "FIXED browser_key_length=$browser_len server_key_length=$server_len backup=$backup"