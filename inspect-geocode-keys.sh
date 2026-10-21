#!/usr/bin/env bash
set -Eeuo pipefail
printf 'databases='
docker exec inviha-track-db psql -U traccar -lqt | cut -d '|' -f1 | tr -d ' ' | grep -E '^(traccar|inviha_app)$' | paste -sd, -
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT 'server_key_length='||length(COALESCE(data->'settings'->>'googleServerGeocodingKey',''))||E'\\nbrowser_key_length='||length(COALESCE(data->'settings'->>'googleMapsKey','')) FROM platform_state WHERE id=1"
docker exec inviha-track-db psql -U traccar -d traccar -Atc "SELECT latitude||','||longitude||'|'||fixtime FROM tc_positions WHERE deviceid=4 ORDER BY id DESC LIMIT 1"