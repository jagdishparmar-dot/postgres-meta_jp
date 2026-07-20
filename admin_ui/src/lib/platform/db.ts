import { Client, Pool, type QueryResultRow } from "pg"

let platformPool: Pool | null = null

export function getMasterUrl(): string | null {
  return (
    process.env.PG_MASTER_URL?.trim() ||
    process.env.MASTER_DATABASE_URL?.trim() ||
    null
  )
}

export function getPlatformDatabaseUrl(): string | null {
  return process.env.PLATFORM_DATABASE_URL?.trim() || null
}

export function isPlatformConfigured(): boolean {
  return Boolean(getMasterUrl() && getPlatformDatabaseUrl())
}

export function getPlatformPool(): Pool {
  const url = getPlatformDatabaseUrl()
  if (!url) {
    throw new Error(
      "PLATFORM_DATABASE_URL is not set. Configure the platform datastore in .env.local."
    )
  }
  if (!platformPool) {
    platformPool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 20_000,
    })
  }
  return platformPool
}

export async function platformQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPlatformPool().query<T>(text, params)
}

export async function closePlatformPool() {
  if (platformPool) {
    await platformPool.end()
    platformPool = null
  }
}

export function parsePgUrl(url: string): {
  protocol: string
  username: string
  password: string
  host: string
  port: string
  database: string
  search: string
} {
  const u = new URL(url)
  return {
    protocol: u.protocol,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || "5432",
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    search: u.search,
  }
}

/** Build a connection URL to a specific database on the same instance as `baseUrl`. */
export function buildDatabaseUrl(baseUrl: string, databaseName: string): string {
  const parts = parsePgUrl(baseUrl)
  const user = encodeURIComponent(parts.username)
  const pass = parts.password ? `:${encodeURIComponent(parts.password)}` : ""
  const db = encodeURIComponent(databaseName)
  return `${parts.protocol}//${user}${pass}@${parts.host}:${parts.port}/${db}${parts.search}`
}

export function isSafeDatabaseName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 63
}

const SYSTEM_DATABASES = new Set(["template0", "template1"])

export function isSystemDatabase(name: string): boolean {
  return SYSTEM_DATABASES.has(name) || name.startsWith("template")
}

export async function withMasterClient<T>(
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const url = getMasterUrl()
  if (!url) {
    throw new Error(
      "PG_MASTER_URL is not set. Add the master instance connection string to .env.local."
    )
  }
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function listInstanceDatabases(opts?: {
  excludeSystem?: boolean
  excludePlatform?: boolean
}): Promise<
  { name: string; owner: string; size: string; size_bytes: number }[]
> {
  const excludeSystem = opts?.excludeSystem !== false
  const excludePlatform = opts?.excludePlatform !== false
  const platformDb = getPlatformDatabaseUrl()
    ? parsePgUrl(getPlatformDatabaseUrl()!).database
    : null

  return withMasterClient(async (client) => {
    const res = await client.query<{
      name: string
      owner: string
      size: string
      size_bytes: string
    }>(
      `SELECT
         d.datname AS name,
         pg_catalog.pg_get_userbyid(d.datdba) AS owner,
         pg_size_pretty(pg_database_size(d.oid)) AS size,
         pg_database_size(d.oid)::text AS size_bytes
       FROM pg_database d
       WHERE d.datallowconn
       ORDER BY d.datname`
    )

    return res.rows
      .filter((row) => {
        if (excludeSystem && isSystemDatabase(row.name)) return false
        if (excludePlatform && platformDb && row.name === platformDb) return false
        return true
      })
      .map((row) => ({
        name: row.name,
        owner: row.owner,
        size: row.size,
        size_bytes: Number(row.size_bytes || 0),
      }))
  })
}

export async function createInstanceDatabase(name: string): Promise<void> {
  const dbName = name.trim()
  if (!isSafeDatabaseName(dbName)) {
    throw new Error(
      "Invalid database name. Use letters, numbers, underscore; start with a letter or _."
    )
  }
  if (isSystemDatabase(dbName)) {
    throw new Error("Cannot use a reserved system database name.")
  }

  await withMasterClient(async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    )
    if (exists.rowCount) {
      throw new Error(`Database "${dbName}" already exists.`)
    }
    // CREATE DATABASE cannot use bind parameters
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
  })
}

export function maskUrlHostDb(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`
  } catch {
    return "configured"
  }
}
