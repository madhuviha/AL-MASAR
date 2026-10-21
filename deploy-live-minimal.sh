#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-live-update-20261001.tgz
expected=D569005A43E4D7314687057FDCF0CA42AE0B3147089A3274FB797B1658C571CA
backend=/opt/inviha-backend
company=/var/www/inviha/company
admin=/var/www/inviha/admin
service=inviha-backend
stage=$(mktemp -d /tmp/inviha-live-stage.XXXXXX)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/var/backups/inviha-live-update-$stamp
changed=0

cleanup(){ rm -rf -- "$stage"; }
rollback(){
  code=$?
  trap - ERR
  if [[ $changed -eq 1 ]]; then
    systemctl stop "$service" || true
    cp -a -- "$backup/backend/server.js" "$backend/server.js"
    if [[ -f "$backup/backend/map-access.mjs" ]]; then cp -a -- "$backup/backend/map-access.mjs" "$backend/map-access.mjs"; else rm -f -- "$backend/map-access.mjs"; fi
    cp -a -- "$backup/company/." "$company/"
    cp -a -- "$backup/admin/." "$admin/"
    systemctl start "$service" || true
  fi
  cleanup
  echo "DEPLOYMENT FAILED. Restored backup: $backup"
  exit "$code"
}
trap rollback ERR
trap cleanup EXIT

[[ $(sha256sum "$archive" | awk '{print toupper($1)}') == "$expected" ]]
systemctl is-active --quiet "$service"
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null
for directory in "$backend" "$company" "$admin"; do [[ -d "$directory" && ! -L "$directory" ]]; done

tar -xzf "$archive" -C "$stage"
node --input-type=module --check < "$stage/backend/server.js"
node --check "$stage/backend/map-access.mjs"
test -f "$stage/company-admin/frontend/dist/index.html"
test -f "$stage/super-admin/frontend/dist/index.html"

install -d -m 700 "$backup/backend" "$backup/company" "$backup/admin"
cp -a -- "$backend/server.js" "$backup/backend/server.js"
if [[ -f "$backend/map-access.mjs" ]]; then cp -a -- "$backend/map-access.mjs" "$backup/backend/map-access.mjs"; fi
cp -a -- "$backend/.env" "$backup/backend.env"
cp -a -- "$company/." "$backup/company/"
cp -a -- "$admin/." "$backup/admin/"

changed=1
systemctl stop "$service"
install -m 644 -- "$stage/backend/server.js" "$backend/server.js"
install -m 644 -- "$stage/backend/map-access.mjs" "$backend/map-access.mjs"
systemctl start "$service"

healthy=0
for attempt in {1..20}; do
  if systemctl is-active --quiet "$service" && curl --fail --silent --max-time 5 http://127.0.0.1:3001/health >/dev/null; then healthy=$((healthy+1)); else healthy=0; fi
  [[ $healthy -ge 3 ]] && break
  sleep 2
done
[[ $healthy -ge 3 ]]

publish(){
  source=$1
  target=$2
  while IFS= read -r -d '' file; do
    relative=${file#"$source/"}
    [[ "$relative" == index.html ]] && continue
    install -d -m 755 -- "$(dirname -- "$target/$relative")"
    install -m 644 -- "$file" "$target/$relative"
  done < <(find "$source" -type f -print0)
  install -m 644 -- "$source/index.html" "$target/.index-new-$stamp"
  mv -f -- "$target/.index-new-$stamp" "$target/index.html"
}

publish "$stage/company-admin/frontend/dist" "$company"
publish "$stage/super-admin/frontend/dist" "$admin"

curl --noproxy '*' --resolve track.inviha.com:443:127.0.0.1 --fail --silent --max-time 10 https://track.inviha.com/ | cmp -s - "$stage/company-admin/frontend/dist/index.html"
curl --noproxy '*' --resolve track.inviha.com:443:127.0.0.1 --fail --silent --max-time 10 https://track.inviha.com/admin/ | cmp -s - "$stage/super-admin/frontend/dist/index.html"
curl --fail --silent --max-time 5 http://127.0.0.1:3001/health

changed=0
trap - ERR
cleanup
trap - EXIT
rm -f -- "$archive" /tmp/deploy-live-minimal.sh
echo
echo "SUCCESS"
echo "Backup: $backup"
