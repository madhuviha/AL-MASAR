#!/usr/bin/env bash
set -Eeuo pipefail
docker exec -i inviha-track-db psql -U traccar -d inviha_app -At <<'SQL'
SELECT 'key_length='||length(COALESCE(data->'settings'->>'googleServerGeocodingKey','')) FROM platform_state WHERE id=1;
SELECT id||'|'||name||'|'||COALESCE(imei,'')||'|'||COALESCE(traccar_device_id::text,'') FROM vehicles WHERE lower(name)=lower('Nissan Patrol');
SQL