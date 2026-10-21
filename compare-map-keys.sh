#!/usr/bin/env bash
set -Eeuo pipefail
backup=$(find /var/backups -maxdepth 1 -type d -name 'inviha-login-branding-*' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
current_browser=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleMapsKey','') FROM platform_state WHERE id=1")
current_server=$(docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT COALESCE(data->'settings'->>'googleServerGeocodingKey','') FROM platform_state WHERE id=1")
old_browser=$(python3 - "$backup/platform-state-before.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
print(data.get('settings',{}).get('googleMapsKey',''))
PY
)
old_server=$(python3 - "$backup/platform-state-before.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
print(data.get('settings',{}).get('googleServerGeocodingKey',''))
PY
)
fingerprint(){ if [[ -z "$1" ]]; then printf empty; else printf %s "$1" | sha256sum | cut -c1-12; fi; }
echo "backup=$backup"
echo "current_browser_length=${#current_browser} fingerprint=$(fingerprint "$current_browser")"
echo "current_server_length=${#current_server} fingerprint=$(fingerprint "$current_server")"
echo "previous_browser_length=${#old_browser} fingerprint=$(fingerprint "$old_browser")"
echo "previous_server_length=${#old_server} fingerprint=$(fingerprint "$old_server")"
if [[ -n "$current_browser" && -n "$old_browser" && "$current_browser" != "$old_browser" && -z "$current_server" ]]; then echo 'arrangement=browser_key_replaced_server_key_empty'; else echo 'arrangement=not_confirmed'; fi