-- v4: per-project API keys & settings (Supabase-style)

ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS jwt_secret text,
  ADD COLUMN IF NOT EXISTS anon_key text,
  ADD COLUMN IF NOT EXISTS service_role_key text,
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS cors_allowed_origins text[] NOT NULL DEFAULT ARRAY['*']::text[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep legacy jsonb column for forward-compatible extras
ALTER TABLE project_settings
  ALTER COLUMN settings SET DEFAULT '{}'::jsonb;

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '4')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
