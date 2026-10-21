#!/usr/bin/env bash
set -euo pipefail
key="$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleMapsKey','') FROM platform_state WHERE id=1")"
test -n "$key"
response="$(curl -fsS -G -H 'Referer: https://track.inviha.com/' \
  --data-urlencode 'latlng=25.2000133,51.5484333' \
  --data-urlencode "key=$key" \
  'https://maps.googleapis.com/maps/api/geocode/json')"
printf '%s' "$response" | jq '{status,error_message,results:[.results[]|{formatted_address,types,address_components:[.address_components[]|{long_name,types}]}]}'
