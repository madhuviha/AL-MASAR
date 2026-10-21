CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  traccar_device_id BIGINT UNIQUE,
  name TEXT NOT NULL,
  plate_number TEXT,
  registration TEXT,
  imei TEXT NOT NULL UNIQUE,
  protocol TEXT,
  device_model TEXT,
  expiration_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_imei ON vehicles(imei);


CREATE TABLE IF NOT EXISTS auth_users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','company_admin','company_user')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_users_company ON auth_users(company_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS company_state (
  company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  updated_by BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_company_time ON audit_events(company_id, created_at DESC);

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

ALTER TABLE companies ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS platform_state(id INTEGER PRIMARY KEY CHECK(id=1),data JSONB NOT NULL DEFAULT '{}'::jsonb,version BIGINT NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS device_inventory(traccar_id BIGINT PRIMARY KEY,metadata JSONB NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS device_admission_attempts (
  id BIGSERIAL PRIMARY KEY,
  protocol TEXT NOT NULL CHECK (protocol IN ('gt06', 'teltonika')),
  imei TEXT NOT NULL CHECK (imei ~ '^[0-9]{8,20}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'declined')),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count BIGINT NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_ip TEXT,
  last_port INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (protocol, imei)
);

CREATE INDEX IF NOT EXISTS idx_device_admission_status_seen
  ON device_admission_attempts(status, last_seen DESC);

CREATE TABLE IF NOT EXISTS diagnostic_events (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'error')),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
  imei TEXT,
  protocol TEXT,
  source_ip TEXT,
  tracker_port INTEGER,
  http_status INTEGER,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_events_time
  ON diagnostic_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diagnostic_events_company_time
  ON diagnostic_events(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reverse_geocode_cache (
  coordinate_key TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'nominatim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reverse_geocode_cache_updated
  ON reverse_geocode_cache(updated_at DESC);
