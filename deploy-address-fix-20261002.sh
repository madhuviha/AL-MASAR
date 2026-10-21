#!/usr/bin/env bash
set -Eeuo pipefail

archive=/tmp/inviha-address-fix-20261002.tgz
expected_sha=0f60cf6ca5158132e8253d18855ec0fb2b594a882752f3daea939a632c576f48
actual_sha=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual_sha" == "$expected_sha" ]]

stage=$(mktemp -d)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/backups/inviha-address-fix-$stamp"
company_new="/var/www/inviha/company.release-$stamp"
mkdir -p "$backup"
tar -xzf "$archive" -C "$stage"

node --check "$stage/backend/google-geocoding.mjs"
test -s "$stage/company/index.html"
grep -q 'index-DbbM2qo0.js' "$stage/company/index.html"

cp -a /opt/inviha-backend/google-geocoding.mjs "$backup/google-geocoding.mjs"
cp -a "$stage/company" "$company_new"

rollback() {
  cp -a "$backup/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs
  if [[ -d "$backup/company-live" ]]; then rm -rf /var/www/inviha/company; mv "$backup/company-live" /var/www/inviha/company; fi
  systemctl restart inviha-backend.service || true
  systemctl start inviha-device-admission.service || true
}
trap rollback ERR

mv /var/www/inviha/company "$backup/company-live"
mv "$company_new" /var/www/inviha/company
install -m 0644 "$stage/backend/google-geocoding.mjs" /opt/inviha-backend/google-geocoding.mjs

docker exec inviha-track-db psql -U traccar -d inviha_app -c "DELETE FROM reverse_geocode_cache WHERE address ~* '^(Bus Stop|Bus Station|Metro Station|Train Station)' OR address ~* '^[0-9]+ .*\\m(Express ?Way|Expressway|Highway|Hwy)\\M'"
docker exec inviha-track-db psql -U traccar -d inviha_app -c "INSERT INTO reverse_geocode_cache(coordinate_key,latitude,longitude,address,provider,updated_at) VALUES('25.2000,51.5484',25.2000133,51.5484333,'Barwa Madinatna, Al Wakrah, Qatar','manual-verified',NOW()) ON CONFLICT(coordinate_key) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,address=EXCLUDED.address,provider=EXCLUDED.provider,updated_at=NOW()"

systemctl restart inviha-backend.service
systemctl start inviha-device-admission.service

for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null && ss -lntH 'sport = :5023' | grep -q LISTEN && ss -lntH 'sport = :5027' | grep -q LISTEN; then break; fi
  sleep 1
done

systemctl is-active --quiet inviha-backend.service
systemctl is-active --quiet inviha-device-admission.service
curl -fsS http://127.0.0.1:3001/health
grep -q 'index-DbbM2qo0.js' /var/www/inviha/company/index.html
docker exec inviha-track-db psql -U traccar -d inviha_app -Atc "SELECT address || '|' || provider FROM reverse_geocode_cache WHERE coordinate_key='25.2000,51.5484'" | grep -Fx 'Barwa Madinatna, Al Wakrah, Qatar|manual-verified'
ss -lntH 'sport = :5023' | grep LISTEN
ss -lntH 'sport = :5027' | grep LISTEN

trap - ERR
rm -rf "$stage"
echo "DEPLOYED backup=$backup"
