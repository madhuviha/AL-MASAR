BEGIN;
CREATE TABLE IF NOT EXISTS device_models (
 id BIGSERIAL PRIMARY KEY, brand TEXT NOT NULL, protocol_key TEXT NOT NULL, series TEXT NOT NULL,
 model TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,capabilities_json JSONB NOT NULL,
 UNIQUE(brand,model)
);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS device_model_id BIGINT REFERENCES device_models(id);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'Normal';
CREATE TABLE IF NOT EXISTS vehicle_io_mappings (
 id BIGSERIAL PRIMARY KEY, vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
 source_type TEXT NOT NULL,source_channel TEXT NOT NULL,function_key TEXT NOT NULL,
 display_name TEXT NOT NULL,active_state TEXT NOT NULL DEFAULT 'HIGH' CHECK(active_state IN ('HIGH','LOW')),
 config_json JSONB NOT NULL DEFAULT '{}',enabled BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(vehicle_id,source_channel)
);
COMMIT;
