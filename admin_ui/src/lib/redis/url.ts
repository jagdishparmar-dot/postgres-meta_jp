/** Redis URL helpers — shared instance (Option B) + optional custom URLs. */

const ALLOWED_PROTOCOLS = new Set(["redis:", "rediss:"])

export const REDIS_DB_MIN = 0
export const REDIS_DB_MAX = 15

export function normalizeRedisUrl(input: string): string {
  const raw = input.trim()
  if (!raw) throw new Error("Redis URL is required")

  let url: URL
  try {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(`redis://${raw}`)
    } else {
      url = new URL(raw)
    }
  } catch {
    throw new Error("Invalid Redis URL")
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error("Redis URL must start with redis:// or rediss://")
  }

  if (!url.hostname) {
    throw new Error("Redis URL must include a host")
  }

  return url.toString()
}

/** Safe display form — never expose password. */
export function maskRedisUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = "***"
    return u.toString()
  } catch {
    return "redis://***"
  }
}

export function parseRedisEndpoint(url: string): {
  host: string
  port: number
  db: number
  tls: boolean
  username: string | null
} {
  const u = new URL(url)
  const dbPath = u.pathname.replace(/^\//, "")
  const db = dbPath ? parseInt(dbPath, 10) : 0
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : u.protocol === "rediss:" ? 6380 : 6379,
    db: Number.isFinite(db) ? db : 0,
    tls: u.protocol === "rediss:",
    username: u.username || null,
  }
}

/** Apply logical DB index to a base Redis URL (Option B). */
export function withRedisDb(baseUrl: string, db: number): string {
  if (!Number.isInteger(db) || db < REDIS_DB_MIN || db > REDIS_DB_MAX) {
    throw new Error(`Redis DB must be an integer ${REDIS_DB_MIN}–${REDIS_DB_MAX}`)
  }
  const u = new URL(normalizeRedisUrl(baseUrl))
  u.pathname = `/${db}`
  return u.toString()
}

/** Shared platform Redis from env (password stays server-side). */
export function getSharedRedisUrl(): string | null {
  const raw = process.env.REDIS_URL?.trim()
  if (!raw) return null
  return normalizeRedisUrl(raw)
}

export function isSharedRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}
