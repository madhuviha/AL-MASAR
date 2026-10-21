#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-geocoding-gateway-20261002.tgz
expected_sha=f687013d89e42e6ea62f094ef67588bb079e7eb81dd781dcbb3b2b92bd762cc5
actual_sha=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_sha" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-geocoding-gateway-$stamp"
mkdir -p "$backup/backend" "$backup/systemd"
tar -xzf "$archive" -C "$stage"

node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/device-admission-gateway.mjs"
bash -n "$stage/backend/inviha-device-admission-watchdog.sh"

cp -a /opt/inviha-backend/server.js "$backup/backend/server.js"
cp -a /opt/inviha-backend/device-admission-gateway.mjs "$backup/backend/device-admission-gateway.mjs"
cp -a /etc/systemd/system/inviha-device-admission.service "$backup/systemd/inviha-device-admission.service"

rollback() {
  cp -a "$backup/backend/server.js" /opt/inviha-backend/server.js
  cp -a "$backup/backend/device-admission-gateway.mjs" /opt/inviha-backend/device-admission-gateway.mjs
  cp -a "$backup/systemd/inviha-device-admission.service" /etc/systemd/system/inviha-device-admission.service
  rm -f /etc/systemd/system/inviha-device-admission-watchdog.service
  rm -f /etc/systemd/system/inviha-device-admission-watchdog.timer
  rm -f /usr/local/sbin/inviha-device-admission-watchdog
  systemctl daemon-reload
  systemctl restart inviha-backend.service || true
  systemctl restart inviha-device-admission.service || true
}
trap rollback ERR

install -m 0644 "$stage/backend/server.js" /opt/inviha-backend/server.js
install -m 0644 "$stage/backend/device-admission-gateway.mjs" /opt/inviha-backend/device-admission-gateway.mjs
install -m 0644 "$stage/backend/inviha-device-admission.service" /etc/systemd/system/inviha-device-admission.service
install -m 0644 "$stage/backend/inviha-device-admission-watchdog.service" /etc/systemd/system/inviha-device-admission-watchdog.service
install -m 0644 "$stage/backend/inviha-device-admission-watchdog.timer" /etc/systemd/system/inviha-device-admission-watchdog.timer
install -m 0755 "$stage/backend/inviha-device-admission-watchdog.sh" /usr/local/sbin/inviha-device-admission-watchdog

systemctl daemon-reload
systemctl restart inviha-backend.service
systemctl restart inviha-device-admission.service
systemctl enable --now inviha-device-admission-watchdog.timer

for attempt in {1..15}; do
  backend_ok=false
  gt06_ok=false
  teltonika_ok=false
  curl -fsS http://127.0.0.1:3001/health >/dev/null && backend_ok=true
  ss -lntH 'sport = :5023' | grep -q LISTEN && gt06_ok=true
  ss -lntH 'sport = :5027' | grep -q LISTEN && teltonika_ok=true
  if [[ "$backend_ok" == true && "$gt06_ok" == true && "$teltonika_ok" == true ]]; then
    break
  fi
  sleep 1
done

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
systemctl is-active --quiet inviha-device-admission-watchdog.timer
curl -fsS http://127.0.0.1:3001/health
ss -lntH 'sport = :5023' | grep LISTEN
ss -lntH 'sport = :5027' | grep LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED backup=$backup"
