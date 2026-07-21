-- v5: per-project Redis (Option D — bring-your-own URL)

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS redis_url_cipher text,
  ADD COLUMN IF NOT EXISTS redis_linked_at timestamptz;

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '5')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
