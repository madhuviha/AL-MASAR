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
