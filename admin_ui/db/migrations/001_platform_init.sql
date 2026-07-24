-- Platform control-plane schema (pgadmin_platform)
-- Applied by: npm run platform:setup

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS platform_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  label         text NOT NULL,
  host_hint     text,
  database_hint text,
  ssl_mode      text NOT NULL DEFAULT 'disable',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text,
  connection_id   uuid NOT NULL REFERENCES connections(id),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived')),
  color           text,
  read_only       boolean NOT NULL DEFAULT false,
  last_opened_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_connection_id_idx ON projects (connection_id);

CREATE TABLE IF NOT EXISTS project_settings (
  project_id   uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
