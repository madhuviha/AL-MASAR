BEGIN;

UPDATE platform_state
SET data = jsonb_set(
      data,
      '{settings}',
      (
        COALESCE(data->'settings', '{}'::jsonb)
        - 'googleMapsKey'
        - 'googleServerGeocodingKey'
        || jsonb_build_object(
          'mapProvider', 'OpenStreetMap',
          'defaultBaseMap', CASE
            WHEN COALESCE(data->'settings'->>'defaultBaseMap', '') LIKE 'google-%' THEN 'osm-road'
            ELSE COALESCE(data->'settings'->>'defaultBaseMap', 'osm-road')
          END,
          'geocoderPrimary', 'nominatim',
          'geocoderFallback', CASE
            WHEN COALESCE(data->'settings'->>'geocoderFallback', 'none') = 'google' THEN 'none'
            ELSE COALESCE(data->'settings'->>'geocoderFallback', 'none')
          END,
          'streetviewProvider', CASE
            WHEN COALESCE(data->'settings'->>'streetviewProvider', 'Mapillary') = 'Google Street View' THEN 'Mapillary'
            ELSE COALESCE(data->'settings'->>'streetviewProvider', 'Mapillary')
          END,
          'enabledMaps',
            COALESCE(data->'settings'->'enabledMaps', '{}'::jsonb)
            - 'googleNormal'
            - 'googleRoad'
            - 'googleSatellite'
            - 'googleHybrid'
            - 'googleTerrain'
        )
      ),
      true
    ),
    version = version + 1,
    updated_at = NOW()
WHERE id = 1;

UPDATE auth_users
SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb)
        - 'googleMapsKey'
        - 'googleServerGeocodingKey',
      '{mapAccess}',
      COALESCE(metadata->'mapAccess', '{}'::jsonb)
        - 'googleNormal'
        - 'googleRoad'
        - 'googleSatellite'
        - 'googleHybrid'
        - 'googleTerrain',
      true
    ) || CASE
      WHEN COALESCE(metadata->>'defaultBaseMap', '') LIKE 'google-%'
        THEN jsonb_build_object('defaultBaseMap', 'osm-road')
      ELSE '{}'::jsonb
    END;

COMMIT;
