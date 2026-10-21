#!/usr/bin/env bash
set -euo pipefail
cd /opt/inviha-backend
set -a
. ./.env
set +a
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/var/backups/al-masar-admin-u2-before-restore-$STAMP.json

psql "$DATABASE_URL" -Atc "SELECT row_to_json(u) FROM (SELECT * FROM auth_users WHERE id=2 AND company_id=3) u" > "$BACKUP"
test -s "$BACKUP"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
UPDATE auth_users
SET role = 'company_admin',
    status = 'active',
    metadata = COALESCE(metadata, '{}'::jsonb) ||
      '{"displayRole":"Company Admin","group":"Company Admin","vehicleIds":[2,3,4,12]}'::jsonb,
    updated_at = NOW()
WHERE id = 2 AND company_id = 3;
DELETE FROM auth_sessions WHERE user_id = 2;
COMMIT;
SQL

psql "$DATABASE_URL" -P pager=off -c "SELECT id,company_id,name,email,role,status,metadata->>'displayRole' AS display_role,metadata->>'group' AS user_group,metadata->'vehicleIds' AS vehicle_ids FROM auth_users WHERE id=2 AND company_id=3"
printf 'ACCOUNT_BACKUP=%s\n' "$BACKUP"
