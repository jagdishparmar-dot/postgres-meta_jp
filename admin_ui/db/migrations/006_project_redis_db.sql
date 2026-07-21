-- v6: Redis Option B — shared REDIS_URL + per-project logical DB (0–15)

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS redis_db integer;

-- One project per logical DB index on the shared instance
CREATE UNIQUE INDEX IF NOT EXISTS project_settings_redis_db_uidx
  ON project_settings (redis_db)
  WHERE redis_db IS NOT NULL;

ALTER TABLE project_settings
  DROP CONSTRAINT IF EXISTS project_settings_redis_db_range;

ALTER TABLE project_settings
  ADD CONSTRAINT project_settings_redis_db_range
  CHECK (redis_db IS NULL OR (redis_db >= 0 AND redis_db <= 15));

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '6')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
