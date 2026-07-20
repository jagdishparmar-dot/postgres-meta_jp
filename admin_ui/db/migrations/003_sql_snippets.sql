-- v3: project-scoped SQL snippets

CREATE TABLE IF NOT EXISTS sql_snippets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  sql         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sql_snippets_project_id_idx
  ON sql_snippets (project_id);

CREATE INDEX IF NOT EXISTS sql_snippets_updated_at_idx
  ON sql_snippets (project_id, updated_at DESC);

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '3')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
