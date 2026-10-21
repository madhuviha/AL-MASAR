#!/usr/bin/env bash
set -euo pipefail

healthy=true
systemctl is-active --quiet inviha-device-admission.service || healthy=false
ss -lntH 'sport = :5023' | grep -q LISTEN || healthy=false
ss -lntH 'sport = :5027' | grep -q LISTEN || healthy=false

if [[ "$healthy" != true ]]; then
  systemctl restart inviha-device-admission.service
fi
