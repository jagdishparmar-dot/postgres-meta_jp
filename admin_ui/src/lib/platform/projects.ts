import {
  buildDatabaseUrl,
  createInstanceDatabase,
  getMasterUrl,
  isSafeDatabaseName,
  listInstanceDatabases,
  platformQuery,
} from "@/lib/platform/db"
import type { PlatformProject } from "@/lib/platform/types"

export type { PlatformProject }

export async function getSchemaVersion(): Promise<string | null> {
  try {
    const res = await platformQuery<{ value: string }>(
      `SELECT value FROM platform_meta WHERE key = 'schema_version'`
    )
    return res.rows[0]?.value ?? null
  } catch {
    return null
  }
}

function mapProject(row: {
  id: string
  name: string
  slug: string
  description: string | null
  database_name: string
  status: "active" | "archived"
  color: string | null
  read_only: boolean
  last_opened_at: Date | null
  created_at: Date
  updated_at: Date
}): PlatformProject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    database_name: row.database_name,
    status: row.status,
    color: row.color,
    read_only: row.read_only,
    last_opened_at: row.last_opened_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

export async function listProjects(opts?: {
  includeArchived?: boolean
}): Promise<PlatformProject[]> {
  const res = await platformQuery<{
    id: string
    name: string
    slug: string
    description: string | null
    database_name: string
    status: "active" | "archived"
    color: string | null
    read_only: boolean
    last_opened_at: Date | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT
       id, name, slug, description, database_name,
       status, color, read_only, last_opened_at, created_at, updated_at
     FROM projects
     WHERE ($1::boolean OR status = 'active')
     ORDER BY COALESCE(last_opened_at, updated_at) DESC`,
    [Boolean(opts?.includeArchived)]
  )
  return res.rows.map(mapProject)
}

export async function getProject(id: string): Promise<PlatformProject | null> {
  const res = await platformQuery<{
    id: string
    name: string
    slug: string
    description: string | null
    database_name: string
    status: "active" | "archived"
    color: string | null
    read_only: boolean
    last_opened_at: Date | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT
       id, name, slug, description, database_name,
       status, color, read_only, last_opened_at, created_at, updated_at
     FROM projects WHERE id = $1`,
    [id]
  )
  const row = res.rows[0]
  return row ? mapProject(row) : null
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || `project-${Date.now().toString(36)}`
  const existing = await platformQuery<{ slug: string }>(
    `SELECT slug FROM projects WHERE slug = $1 OR slug LIKE $2`,
    [slug, `${slug}-%`]
  )
  const taken = new Set(existing.rows.map((r) => r.slug))
  if (!taken.has(slug)) return slug
  let i = 2
  while (taken.has(`${slug}-${i}`)) i++
  return `${slug}-${i}`
}

export async function listDatabasesForLinking() {
  const dbs = await listInstanceDatabases({
    excludeSystem: true,
    excludePlatform: true,
  })
  const projects = await listProjects({ includeArchived: true })
  const byDb = new Map(
    projects
      .filter((p) => p.status === "active")
      .map((p) => [p.database_name, p])
  )

  return dbs.map((db) => ({
    ...db,
    linked_project_id: byDb.get(db.name)?.id ?? null,
    linked_project_name: byDb.get(db.name)?.name ?? null,
  }))
}

export async function createProject(input: {
  name: string
  slug?: string
  description?: string
  mode: "link" | "create"
  database_name: string
  color?: string
  read_only?: boolean
}): Promise<PlatformProject> {
  const name = input.name.trim()
  if (!name) throw new Error("Project name is required")

  const databaseName = input.database_name.trim()
  if (!isSafeDatabaseName(databaseName)) {
    throw new Error(
      "Invalid database name. Use letters, numbers, underscore; start with a letter or _."
    )
  }

  if (input.mode === "create") {
    await createInstanceDatabase(databaseName)
  } else {
    const dbs = await listInstanceDatabases({
      excludeSystem: false,
      excludePlatform: false,
    })
    if (!dbs.some((d) => d.name === databaseName)) {
      throw new Error(
        `Database "${databaseName}" was not found on the instance.`
      )
    }
  }

  const linked = await platformQuery<{ id: string; name: string }>(
    `SELECT id, name FROM projects WHERE database_name = $1 AND status = 'active'`,
    [databaseName]
  )
  if (linked.rows[0]) {
    throw new Error(
      `Database "${databaseName}" is already linked to project "${linked.rows[0].name}".`
    )
  }

  const slug = await uniqueSlug(input.slug || name)

  const res = await platformQuery<{ id: string }>(
    `INSERT INTO projects (name, slug, description, database_name, color, read_only)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      name,
      slug,
      input.description?.trim() || null,
      databaseName,
      input.color || null,
      Boolean(input.read_only),
    ]
  )

  const project = await getProject(res.rows[0].id)
  if (!project) throw new Error("Failed to load created project")

  try {
    const { ensureProjectApiSettings } = await import(
      "@/lib/platform/project-settings"
    )
    await ensureProjectApiSettings(project.id)
  } catch {
    // settings can be created lazily on first visit
  }

  return project
}

export async function updateProject(
  id: string,
  patch: {
    name?: string
    slug?: string
    description?: string | null
    status?: "active" | "archived"
    color?: string | null
    read_only?: boolean
  }
): Promise<PlatformProject | null> {
  const current = await getProject(id)
  if (!current) return null

  const name = patch.name?.trim() ?? current.name
  const slug = patch.slug ? slugify(patch.slug) : current.slug
  const description =
    patch.description === undefined
      ? current.description
      : patch.description?.trim() || null
  const status = patch.status ?? current.status
  const color =
    patch.color === undefined ? current.color : patch.color?.trim() || null
  const readOnly =
    patch.read_only === undefined ? current.read_only : patch.read_only

  await platformQuery(
    `UPDATE projects SET
       name = $2,
       slug = $3,
       description = $4,
       status = $5,
       color = $6,
       read_only = $7,
       updated_at = now()
     WHERE id = $1`,
    [id, name, slug, description, status, color, readOnly]
  )

  if (slug !== current.slug) {
    try {
      const { remintProjectApiKeys } = await import(
        "@/lib/platform/project-settings"
      )
      await remintProjectApiKeys(id)
    } catch {
      // ignore
    }
  }

  return getProject(id)
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await platformQuery(`DELETE FROM projects WHERE id = $1`, [id])
  return (res.rowCount ?? 0) > 0
}

export async function markProjectOpened(id: string): Promise<void> {
  await platformQuery(
    `UPDATE projects SET last_opened_at = now(), updated_at = now() WHERE id = $1`,
    [id]
  )
}

export async function resolveProjectConnectionString(
  projectId: string
): Promise<{ project: PlatformProject; connectionString: string } | null> {
  const project = await getProject(projectId)
  if (!project || project.status !== "active") return null

  const master = getMasterUrl()
  if (!master) {
    throw new Error("PG_MASTER_URL is not configured.")
  }

  return {
    project,
    connectionString: buildDatabaseUrl(master, project.database_name),
  }
}

/** @deprecated no-op — replaced by master instance databases */
export async function syncConnectionsFromEnv(): Promise<void> {}
