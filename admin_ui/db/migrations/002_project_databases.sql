-- v2: projects own a database_name on the master Postgres instance
-- (replaces env DB_CONN_* + connections catalog)

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_connection_id_fkey;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS database_name text;

-- Best-effort migrate from old connections catalog
UPDATE projects p
SET database_name = COALESCE(
  NULLIF(p.database_name, ''),
  (SELECT c.database_hint FROM connections c WHERE c.id = p.connection_id),
  p.slug
)
WHERE p.database_name IS NULL OR p.database_name = '';

UPDATE projects SET database_name = slug WHERE database_name IS NULL OR database_name = '';

-- Deduplicate active projects sharing the same database_name:
-- keep the most recently updated; suffix others so the unique index can be created.
WITH ranked AS (
  SELECT
    id,
    database_name,
    ROW_NUMBER() OVER (
      PARTITION BY database_name
      ORDER BY COALESCE(last_opened_at, updated_at) DESC, created_at DESC
    ) AS rn
  FROM projects
  WHERE status = 'active'
)
UPDATE projects p
SET database_name = p.database_name || '_' || substr(replace(p.id::text, '-', ''), 1, 8),
    updated_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE projects ALTER COLUMN database_name SET NOT NULL;

-- connection_id no longer required
ALTER TABLE projects ALTER COLUMN connection_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_database_name_active_uidx
  ON projects (database_name)
  WHERE status = 'active';

INSERT INTO platform_meta (key, value)
VALUES ('schema_version', '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
