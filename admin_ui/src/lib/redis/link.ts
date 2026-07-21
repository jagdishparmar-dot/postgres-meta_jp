import { platformQuery } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import { decryptSecret, encryptSecret } from "@/lib/vault-crypto"
import {
  getSharedRedisUrl,
  isSharedRedisConfigured,
  maskRedisUrl,
  normalizeRedisUrl,
  parseRedisEndpoint,
  REDIS_DB_MAX,
  REDIS_DB_MIN,
  withRedisDb,
} from "@/lib/redis/url"

export type ProjectRedisLink = {
  linked: boolean
  mode: "shared" | "custom" | null
  url_masked: string | null
  host: string | null
  port: number | null
  db: number | null
  tls: boolean
  linked_at: string | null
}

export type RedisPlatformStatus = {
  configured: boolean
  url_masked: string | null
  host: string | null
  port: number | null
  db_min: number
  db_max: number
  used_dbs: number[]
  available_dbs: number[]
}

async function ensureColumns(): Promise<void> {
  await platformQuery(`
    ALTER TABLE project_settings
      ADD COLUMN IF NOT EXISTS redis_url_cipher text,
      ADD COLUMN IF NOT EXISTS redis_linked_at timestamptz,
      ADD COLUMN IF NOT EXISTS redis_db integer
  `)
  await platformQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS project_settings_redis_db_uidx
      ON project_settings (redis_db)
      WHERE redis_db IS NOT NULL
  `)
}

async function ensureSettingsRow(projectId: string): Promise<void> {
  await ensureColumns()
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  await platformQuery(
    `INSERT INTO project_settings (project_id, settings, updated_at)
     VALUES ($1, '{}'::jsonb, now())
     ON CONFLICT (project_id) DO NOTHING`,
    [projectId]
  )
}

export async function getUsedRedisDbs(): Promise<number[]> {
  await ensureColumns()
  const res = await platformQuery<{ redis_db: number }>(
    `SELECT redis_db FROM project_settings
     WHERE redis_db IS NOT NULL
     ORDER BY redis_db`
  )
  return res.rows.map((r) => r.redis_db)
}

export async function getRedisPlatformStatus(): Promise<RedisPlatformStatus> {
  const shared = getSharedRedisUrl()
  const used = await getUsedRedisDbs()
  const usedSet = new Set(used)
  const available = []
  for (let i = REDIS_DB_MIN; i <= REDIS_DB_MAX; i++) {
    if (!usedSet.has(i)) available.push(i)
  }

  if (!shared) {
    return {
      configured: false,
      url_masked: null,
      host: null,
      port: null,
      db_min: REDIS_DB_MIN,
      db_max: REDIS_DB_MAX,
      used_dbs: used,
      available_dbs: available,
    }
  }

  const ep = parseRedisEndpoint(shared)
  return {
    configured: true,
    url_masked: maskRedisUrl(shared),
    host: ep.host,
    port: ep.port,
    db_min: REDIS_DB_MIN,
    db_max: REDIS_DB_MAX,
    used_dbs: used,
    available_dbs: available,
  }
}

/** Resolve connection URL for a project (shared DB index or legacy custom URL). */
export async function getProjectRedisUrl(
  projectId: string
): Promise<string | null> {
  await ensureColumns()
  const res = await platformQuery<{
    redis_db: number | null
    redis_url_cipher: string | null
  }>(
    `SELECT redis_db, redis_url_cipher FROM project_settings WHERE project_id = $1`,
    [projectId]
  )
  const row = res.rows[0]
  if (!row) return null

  if (row.redis_db != null) {
    const shared = getSharedRedisUrl()
    if (!shared) {
      throw new Error(
        "Project is linked to a Redis DB index but REDIS_URL is not configured"
      )
    }
    return withRedisDb(shared, row.redis_db)
  }

  // Legacy Option D: full custom URL
  if (row.redis_url_cipher) {
    try {
      return decryptSecret(row.redis_url_cipher)
    } catch {
      throw new Error("Failed to decrypt Redis URL — check CONNECTION_VAULT_KEY")
    }
  }

  return null
}

export async function getProjectRedisLink(
  projectId: string
): Promise<ProjectRedisLink> {
  await ensureColumns()
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  const res = await platformQuery<{
    redis_db: number | null
    redis_url_cipher: string | null
    redis_linked_at: Date | null
  }>(
    `SELECT redis_db, redis_url_cipher, redis_linked_at
     FROM project_settings WHERE project_id = $1`,
    [projectId]
  )

  const row = res.rows[0]
  if (!row || (row.redis_db == null && !row.redis_url_cipher)) {
    return {
      linked: false,
      mode: null,
      url_masked: null,
      host: null,
      port: null,
      db: null,
      tls: false,
      linked_at: null,
    }
  }

  if (row.redis_db != null) {
    const shared = getSharedRedisUrl()
    if (!shared) {
      return {
        linked: true,
        mode: "shared",
        url_masked: null,
        host: null,
        port: null,
        db: row.redis_db,
        tls: false,
        linked_at: row.redis_linked_at?.toISOString() ?? null,
      }
    }
    const url = withRedisDb(shared, row.redis_db)
    const ep = parseRedisEndpoint(url)
    return {
      linked: true,
      mode: "shared",
      url_masked: maskRedisUrl(url),
      host: ep.host,
      port: ep.port,
      db: row.redis_db,
      tls: ep.tls,
      linked_at: row.redis_linked_at?.toISOString() ?? null,
    }
  }

  const url = decryptSecret(row.redis_url_cipher!)
  const ep = parseRedisEndpoint(url)
  return {
    linked: true,
    mode: "custom",
    url_masked: maskRedisUrl(url),
    host: ep.host,
    port: ep.port,
    db: ep.db,
    tls: ep.tls,
    linked_at: row.redis_linked_at?.toISOString() ?? null,
  }
}

function assertDbIndex(db: number): number {
  if (!Number.isInteger(db) || db < REDIS_DB_MIN || db > REDIS_DB_MAX) {
    throw new Error(`Redis DB must be an integer ${REDIS_DB_MIN}–${REDIS_DB_MAX}`)
  }
  return db
}

/** Allocate next free logical DB, or use the requested index if free. */
export async function allocateRedisDb(preferred?: number | null): Promise<number> {
  const used = new Set(await getUsedRedisDbs())
  if (preferred != null) {
    const db = assertDbIndex(preferred)
    if (used.has(db)) {
      throw new Error(`Redis DB ${db} is already linked to another project`)
    }
    return db
  }
  for (let i = REDIS_DB_MIN; i <= REDIS_DB_MAX; i++) {
    if (!used.has(i)) return i
  }
  throw new Error(
    `All Redis DB indexes (${REDIS_DB_MIN}–${REDIS_DB_MAX}) are in use`
  )
}

/** Option B: link project to shared REDIS_URL at a logical DB index. */
export async function linkProjectRedisDb(
  projectId: string,
  preferredDb?: number | null
): Promise<ProjectRedisLink> {
  if (!isSharedRedisConfigured()) {
    throw new Error(
      "REDIS_URL is not configured. Set it in .env.local (shared Redis instance)."
    )
  }
  await ensureSettingsRow(projectId)
  const db = await allocateRedisDb(preferredDb ?? null)

  try {
    await platformQuery(
      `UPDATE project_settings SET
         redis_db = $2,
         redis_url_cipher = NULL,
         redis_linked_at = now(),
         updated_at = now()
       WHERE project_id = $1`,
      [projectId, db]
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("project_settings_redis_db_uidx") || msg.includes("unique")) {
      throw new Error(`Redis DB ${db} is already linked to another project`)
    }
    throw err
  }

  return getProjectRedisLink(projectId)
}

/** Legacy Option D: link a custom Redis URL (optional override). */
export async function linkProjectRedisCustom(
  projectId: string,
  redisUrl: string
): Promise<ProjectRedisLink> {
  await ensureSettingsRow(projectId)
  const normalized = normalizeRedisUrl(redisUrl)
  const cipher = encryptSecret(normalized)

  await platformQuery(
    `UPDATE project_settings SET
       redis_url_cipher = $2,
       redis_db = NULL,
       redis_linked_at = now(),
       updated_at = now()
     WHERE project_id = $1`,
    [projectId, cipher]
  )

  return getProjectRedisLink(projectId)
}

export async function unlinkProjectRedis(
  projectId: string
): Promise<ProjectRedisLink> {
  await ensureColumns()
  await platformQuery(
    `UPDATE project_settings SET
       redis_url_cipher = NULL,
       redis_db = NULL,
       redis_linked_at = NULL,
       updated_at = now()
     WHERE project_id = $1`,
    [projectId]
  )
  return getProjectRedisLink(projectId)
}
