#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-admin-map-selection-20261003.tgz
expected_sha=ab63a03bb7e006b19d717de7f80d9a7ff3994bce96dfdb427325fded1519edf5
admin_web=/var/www/inviha/admin

[[ $(id -u) -eq 0 ]]
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_sha" ]]
[[ -d "$admin_web" && ! -L "$admin_web" && -f "$admin_web/index.html" ]]
systemctl is-active --quiet inviha-backend.service
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-admin-map-selection-$stamp"
admin_new="/var/www/inviha/admin.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"
grep -q 'index-D-QpkoMk.js' "$stage/admin/index.html"
grep -q 'index-CVLF-7lX.css' "$stage/admin/index.html"
grep -q 'Deselect all' "$stage/admin/assets/index-D-QpkoMk.js"
grep -q 'legacyMapActions' "$stage/admin/assets/index-CVLF-7lX.css"
cp -a "$admin_web" "$backup/admin-live"
cp -a "$stage/admin" "$admin_new"

changed=0
rollback(){
  local code=$?
  trap - ERR INT TERM
  set +e
  if [[ $changed -eq 1 ]]; then
    rm -rf "$admin_web"
    mv "$backup/admin-live" "$admin_web"
  fi
  rm -rf "$stage" "$admin_new"
  echo "Deployment rolled back. Backup: $backup"
  exit "$code"
}
trap rollback ERR INT TERM

changed=1
mv "$admin_web" "$backup/admin-original"
mv "$admin_new" "$admin_web"
curl -fsS --max-time 10 https://admin.inviha.com/admin/ | grep -q 'index-D-QpkoMk.js'
systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:3001/health >/dev/null

trap - ERR INT TERM
rm -rf "$stage"
echo "DEPLOYED admin-map-selection backup=$backup"
