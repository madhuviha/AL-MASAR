BEGIN;
CREATE TABLE IF NOT EXISTS drivers (
 company_id BIGINT NOT NULL REFERENCES companies(id), id TEXT NOT NULL,
 name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 details JSONB NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY(company_id,id)
);
CREATE TABLE IF NOT EXISTS driver_identifiers (
 id BIGSERIAL PRIMARY KEY,company_id BIGINT NOT NULL,driver_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('RFID','IBUTTON','DRIVER_ID')),
 identifier_normalized TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(company_id,driver_id) REFERENCES drivers(company_id,id),
 UNIQUE(company_id,driver_id,identifier_normalized)
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_identifier_active_unique ON driver_identifiers(company_id,identifier_normalized) WHERE active;
CREATE TABLE IF NOT EXISTS vehicle_driver_sessions (
 id BIGSERIAL PRIMARY KEY,company_id BIGINT NOT NULL REFERENCES companies(id),
 vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),driver_id TEXT,
 identifier_id BIGINT REFERENCES driver_identifiers(id),driver_name TEXT,
 identifier_raw TEXT NOT NULL,identifier_normalized TEXT NOT NULL,identifier_type TEXT NOT NULL,
 source TEXT NOT NULL,started_at TIMESTAMPTZ NOT NULL,ended_at TIMESTAMPTZ,
 FOREIGN KEY(company_id,driver_id) REFERENCES drivers(company_id,id),
 CHECK(ended_at IS NULL OR ended_at>=started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_session_vehicle_active ON vehicle_driver_sessions(company_id,vehicle_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS driver_session_driver_active ON vehicle_driver_sessions(company_id,driver_id) WHERE ended_at IS NULL AND driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_sessions_history ON vehicle_driver_sessions(company_id,vehicle_id,started_at);
CREATE TABLE IF NOT EXISTS driver_identification_events (
 id BIGSERIAL PRIMARY KEY,company_id BIGINT NOT NULL REFERENCES companies(id),vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
 position_key TEXT NOT NULL,event_time TIMESTAMPTZ NOT NULL,identifier_raw TEXT NOT NULL,
 identifier_normalized TEXT NOT NULL,identifier_type TEXT NOT NULL,source TEXT NOT NULL,
 driver_id TEXT,driver_name TEXT,applied BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(company_id,driver_id) REFERENCES drivers(company_id,id),UNIQUE(company_id,vehicle_id,position_key)
);
CREATE INDEX IF NOT EXISTS driver_events_history ON driver_identification_events(company_id,vehicle_id,event_time);
CREATE TABLE IF NOT EXISTS driver_identity_cursor (
 company_id BIGINT NOT NULL REFERENCES companies(id),vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
 scanned_until TIMESTAMPTZ,last_identifier TEXT,last_event_time TIMESTAMPTZ,PRIMARY KEY(company_id,vehicle_id)
);

ALTER TABLE driver_identity_cursor ADD COLUMN IF NOT EXISTS last_position_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicle_tenant_key ON vehicles(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS driver_identifier_tenant_key ON driver_identifiers(company_id,id);
-- Keep protocol diagnostics truthful on existing installations.  This is additive
-- and preserves any administrator-customized existing listener rows.
CREATE TABLE IF NOT EXISTS protocol_profiles (
 protocol TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 transport TEXT NOT NULL DEFAULT 'TCP' CHECK (transport IN ('TCP','UDP','TCP/UDP')),
 tcp_port INTEGER,
 udp_port INTEGER,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 notes TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO protocol_profiles(protocol,display_name,transport,tcp_port,enabled,notes)
VALUES ('gt06','GT06','TCP',5023,TRUE,'Current H9 receiver')
ON CONFLICT(protocol) DO NOTHING;
INSERT INTO protocol_profiles(protocol,display_name,transport,tcp_port,enabled,notes)
VALUES ('teltonika','Teltonika','TCP',5027,TRUE,'Teltonika TCP receiver; expose this port on the VPS and use a DNS-only tracker hostname')
ON CONFLICT(protocol) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='driver_sessions_vehicle_tenant') THEN
  ALTER TABLE vehicle_driver_sessions ADD CONSTRAINT driver_sessions_vehicle_tenant FOREIGN KEY(company_id,vehicle_id) REFERENCES vehicles(company_id,id);
  ALTER TABLE vehicle_driver_sessions ADD CONSTRAINT driver_sessions_identifier_tenant FOREIGN KEY(company_id,identifier_id) REFERENCES driver_identifiers(company_id,id);
  ALTER TABLE driver_identification_events ADD CONSTRAINT driver_events_vehicle_tenant FOREIGN KEY(company_id,vehicle_id) REFERENCES vehicles(company_id,id);
  ALTER TABLE driver_identity_cursor ADD CONSTRAINT driver_cursor_vehicle_tenant FOREIGN KEY(company_id,vehicle_id) REFERENCES vehicles(company_id,id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS driver_master_sync (
 company_id BIGINT PRIMARY KEY REFERENCES companies(id),digest TEXT NOT NULL
);
COMMIT;
