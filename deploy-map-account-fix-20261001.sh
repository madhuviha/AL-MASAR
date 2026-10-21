#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=/tmp/inviha-map-account-fix-20261001.tgz
expected=974DAAA28879BA37829B8C57A13E34554DEE87CCAD65EBD08D7EAB3E6149C219
backend=/opt/inviha-backend
company=/var/www/inviha/company
admin=/var/www/inviha/admin
service=inviha-backend
stage=$(mktemp -d /tmp/inviha-map-account.XXXXXX)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/var/backups/inviha-map-account-fix-$stamp
changed=0

cleanup(){ rm -rf -- "$stage"; }
rollback(){
  code=$?
  trap - ERR
  if [[ $changed -eq 1 ]]; then
    systemctl stop "$service" || true
    cp -a -- "$backup/backend/server.js" "$backend/server.js"
    rm -rf -- "$company"/* "$admin"/*
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
tar -xzf "$archive" -C "$stage"
node --input-type=module --check < "$stage/backend/server.js"
test -f "$stage/company-admin/frontend/dist/index.html"
test -f "$stage/super-admin/frontend/dist/index.html"

install -d -m 700 "$backup/backend" "$backup/company" "$backup/admin"
cp -a -- "$backend/server.js" "$backup/backend/server.js"
cp -a -- "$company/." "$backup/company/"
cp -a -- "$admin/." "$backup/admin/"

changed=1
systemctl stop "$service"
install -m 644 -- "$stage/backend/server.js" "$backend/server.js"
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
curl --noproxy '*' --resolve admin.inviha.com:443:127.0.0.1 --fail --silent --max-time 10 https://admin.inviha.com/admin/ | cmp -s - "$stage/super-admin/frontend/dist/index.html"

changed=0
trap - ERR
cleanup
trap - EXIT
printf 'DEPLOYED_BACKUP=%s\n' "$backup"
printf 'COMPANY_ASSET=%s\n' "$(grep -o 'assets/index-[^\" ]*\.js' "$company/index.html" | head -n1)"
printf 'ADMIN_ASSET=%s\n' "$(grep -o 'assets/index-[^\" ]*\.js' "$admin/index.html" | head -n1)"
