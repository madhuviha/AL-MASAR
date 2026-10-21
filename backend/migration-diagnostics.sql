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
