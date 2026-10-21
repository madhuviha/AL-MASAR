#!/usr/bin/env bash
set -euo pipefail
cd /opt/inviha-backend
set -a
. ./.env
set +a
psql "$DATABASE_URL" -P pager=off <<'SQL'
SELECT id, company_id, name, email, role, status,
       metadata->>'displayRole' AS display_role,
       metadata->>'group' AS user_group,
       metadata->'mapAccess' AS map_access,
       metadata->'vehicleIds' AS vehicle_ids
FROM auth_users
WHERE company_id = 3
ORDER BY id;

SELECT id, company_id, name, imei, active, expiration_date
FROM vehicles
WHERE company_id = 3
ORDER BY id;
SQL
