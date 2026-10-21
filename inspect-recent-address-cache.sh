#!/usr/bin/env bash
set -Eeuo pipefail
docker exec inviha-track-db psql -U traccar -d inviha_app -P pager=off -c "SELECT coordinate_key,address,provider,updated_at FROM reverse_geocode_cache ORDER BY updated_at DESC LIMIT 12"