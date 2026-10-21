#!/usr/bin/env bash
set -euo pipefail

ARCHIVE=/tmp/inviha-super-actions-20261001.tgz
EXPECTED=4a78904914203dcc429b069e9bd627269ef0df6737a1c06d07676b86d771b9c0
LIVE=/var/www/inviha/admin
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/var/backups/inviha-super-actions-$STAMP
STAGE=$(mktemp -d /tmp/inviha-super-actions.XXXXXX)

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

ACTUAL=$(sha256sum "$ARCHIVE" | awk '{print $1}')
test "$ACTUAL" = "$EXPECTED"
tar -xzf "$ARCHIVE" -C "$STAGE"
test -f "$STAGE/super-admin/frontend/dist/index.html"

mkdir -p "$BACKUP"
cp -a "$LIVE/." "$BACKUP/"

rollback() {
  rm -rf "$LIVE"/*
  cp -a "$BACKUP/." "$LIVE/"
}
trap 'rollback; cleanup' ERR

find "$LIVE" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$STAGE/super-admin/frontend/dist/." "$LIVE/"
test -f "$LIVE/index.html"

curl -fsS --resolve admin.inviha.com:443:127.0.0.1 https://admin.inviha.com/admin/ >/dev/null
trap cleanup EXIT
printf 'DEPLOYED_BACKUP=%s\n' "$BACKUP"
printf 'ASSET=%s\n' "$(grep -o 'assets/index-[^\" ]*\.js' "$LIVE/index.html" | head -n1)"
