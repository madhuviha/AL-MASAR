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
