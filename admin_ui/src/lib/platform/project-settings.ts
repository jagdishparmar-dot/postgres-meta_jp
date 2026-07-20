import { platformQuery } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import {
  generateJwtSecret,
  mintApiKeys,
  parseCorsOrigins,
  resolveDefaultApiUrl,
} from "@/lib/platform/api-keys"

export type ProjectApiSettings = {
  project_id: string
  jwt_secret: string
  anon_key: string
  service_role_key: string
  api_url: string
  cors_allowed_origins: string[]
  created_at: string
  updated_at: string
}

type SettingsRow = {
  project_id: string
  jwt_secret: string
  anon_key: string
  service_role_key: string
  api_url: string | null
  cors_allowed_origins: string[] | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: SettingsRow): ProjectApiSettings {
  return {
    project_id: row.project_id,
    jwt_secret: row.jwt_secret,
    anon_key: row.anon_key,
    service_role_key: row.service_role_key,
    api_url: row.api_url || resolveDefaultApiUrl(row.project_id),
    cors_allowed_origins:
      row.cors_allowed_origins?.length ? row.cors_allowed_origins : ["*"],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

/** Ensure schema columns exist (idempotent for DBs that haven't run migration 004 yet). */
async function ensureColumns(): Promise<void> {
  await platformQuery(`
    ALTER TABLE project_settings
      ADD COLUMN IF NOT EXISTS jwt_secret text,
      ADD COLUMN IF NOT EXISTS anon_key text,
      ADD COLUMN IF NOT EXISTS service_role_key text,
      ADD COLUMN IF NOT EXISTS api_url text,
      ADD COLUMN IF NOT EXISTS cors_allowed_origins text[] NOT NULL DEFAULT ARRAY['*']::text[],
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `)
}

export async function ensureProjectApiSettings(
  projectId: string
): Promise<ProjectApiSettings> {
  await ensureColumns()
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  const existing = await platformQuery<{
    project_id: string
    jwt_secret: string | null
    anon_key: string | null
    service_role_key: string | null
    api_url: string | null
    cors_allowed_origins: string[] | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT project_id, jwt_secret, anon_key, service_role_key, api_url,
            cors_allowed_origins, created_at, updated_at
     FROM project_settings WHERE project_id = $1`,
    [projectId]
  )

  if (existing.rows[0]?.jwt_secret && existing.rows[0]?.anon_key) {
    return mapRow({
      ...existing.rows[0],
      jwt_secret: existing.rows[0].jwt_secret!,
      anon_key: existing.rows[0].anon_key!,
      service_role_key: existing.rows[0].service_role_key!,
    })
  }

  const secret = generateJwtSecret()
  const keys = mintApiKeys({ secret, projectRef: project.slug })
  const apiUrl = resolveDefaultApiUrl(projectId)

  const res = await platformQuery<SettingsRow>(
    `INSERT INTO project_settings (
       project_id, jwt_secret, anon_key, service_role_key, api_url,
       cors_allowed_origins, settings, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, now())
     ON CONFLICT (project_id) DO UPDATE SET
       jwt_secret = COALESCE(project_settings.jwt_secret, EXCLUDED.jwt_secret),
       anon_key = COALESCE(project_settings.anon_key, EXCLUDED.anon_key),
       service_role_key = COALESCE(project_settings.service_role_key, EXCLUDED.service_role_key),
       api_url = COALESCE(project_settings.api_url, EXCLUDED.api_url),
       cors_allowed_origins = COALESCE(project_settings.cors_allowed_origins, EXCLUDED.cors_allowed_origins),
       updated_at = now()
     RETURNING project_id, jwt_secret, anon_key, service_role_key, api_url,
               cors_allowed_origins, created_at, updated_at`,
    [
      projectId,
      secret,
      keys.anon_key,
      keys.service_role_key,
      apiUrl,
      ["*"],
    ]
  )

  // If row existed with partial nulls, force-fill
  const row = res.rows[0]
  if (!row.jwt_secret || !row.anon_key) {
    return rotateProjectApiKeys(projectId)
  }
  return mapRow(row)
}

export async function getProjectApiSettings(
  projectId: string
): Promise<ProjectApiSettings> {
  return ensureProjectApiSettings(projectId)
}

export async function updateProjectApiSettings(
  projectId: string,
  patch: {
    api_url?: string | null
    cors_allowed_origins?: string[] | string
  }
): Promise<ProjectApiSettings> {
  await ensureProjectApiSettings(projectId)

  if (patch.cors_allowed_origins !== undefined) {
    const cors = parseCorsOrigins(patch.cors_allowed_origins)
    await platformQuery(
      `UPDATE project_settings SET cors_allowed_origins = $2, updated_at = now()
       WHERE project_id = $1`,
      [projectId, cors]
    )
  }

  if (patch.api_url !== undefined) {
    await platformQuery(
      `UPDATE project_settings SET api_url = $2, updated_at = now()
       WHERE project_id = $1`,
      [projectId, patch.api_url?.trim() || null]
    )
  }

  return getProjectApiSettings(projectId)
}

export async function rotateProjectApiKeys(
  projectId: string
): Promise<ProjectApiSettings> {
  await ensureColumns()
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  const secret = generateJwtSecret()
  const keys = mintApiKeys({ secret, projectRef: project.slug })
  const apiUrl = resolveDefaultApiUrl(projectId)

  const res = await platformQuery<SettingsRow>(
    `INSERT INTO project_settings (
       project_id, jwt_secret, anon_key, service_role_key, api_url,
       cors_allowed_origins, settings, updated_at
     ) VALUES ($1, $2, $3, $4, $5, ARRAY['*']::text[], '{}'::jsonb, now())
     ON CONFLICT (project_id) DO UPDATE SET
       jwt_secret = EXCLUDED.jwt_secret,
       anon_key = EXCLUDED.anon_key,
       service_role_key = EXCLUDED.service_role_key,
       api_url = COALESCE(project_settings.api_url, EXCLUDED.api_url),
       updated_at = now()
     RETURNING project_id, jwt_secret, anon_key, service_role_key, api_url,
               cors_allowed_origins, created_at, updated_at`,
    [projectId, secret, keys.anon_key, keys.service_role_key, apiUrl]
  )
  return mapRow(res.rows[0])
}

/** Remint anon/service_role JWTs with existing secret (e.g. after slug change). */
export async function remintProjectApiKeys(
  projectId: string
): Promise<ProjectApiSettings> {
  const current = await ensureProjectApiSettings(projectId)
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  const keys = mintApiKeys({
    secret: current.jwt_secret,
    projectRef: project.slug,
  })

  const res = await platformQuery<SettingsRow>(
    `UPDATE project_settings SET
       anon_key = $2,
       service_role_key = $3,
       updated_at = now()
     WHERE project_id = $1
     RETURNING project_id, jwt_secret, anon_key, service_role_key, api_url,
               cors_allowed_origins, created_at, updated_at`,
    [projectId, keys.anon_key, keys.service_role_key]
  )
  return mapRow(res.rows[0])
}
