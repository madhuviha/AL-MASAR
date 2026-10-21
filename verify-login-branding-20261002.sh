#!/usr/bin/env bash
set -Eeuo pipefail
systemctl is-active inviha-backend.service
systemctl is-active inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3001/api/public/branding
curl -fsS https://track.inviha.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1
curl -fsS https://admin.inviha.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1
curl -sS -D /tmp/login-bg-headers -o /tmp/login-bg-image -w 'background_http=%{http_code} seconds=%{time_total} bytes=%{size_download}\n' https://track.inviha.com/inviha-api/api/public/login-background
content_type=$(awk 'BEGIN{IGNORECASE=1}/^content-type:/{gsub("\r","");print $2}' /tmp/login-bg-headers | tail -1)
etag=$(awk 'BEGIN{IGNORECASE=1}/^etag:/{sub(/^[^:]*:[[:space:]]*/,"");gsub("\r","");print}' /tmp/login-bg-headers | tail -1)
echo "content_type=$content_type etag_present=$([[ -n "$etag" ]] && echo yes || echo no)"
curl -sS -o /dev/null -w 'cached_validation_http=%{http_code} seconds=%{time_total}\n' -H "If-None-Match: $etag" https://track.inviha.com/inviha-api/api/public/login-background
ss -lntH 'sport = :5023'
ss -lntH 'sport = :5027'
