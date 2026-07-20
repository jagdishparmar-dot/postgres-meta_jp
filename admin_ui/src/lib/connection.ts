export type SslMode = "disable" | "require" | "prefer"

/** Form / full config. Password is only used when creating or updating. */
export type DbConnectionConfig = {
  id?: string
  name: string
  host: string
  port: string
  database: string
  user: string
  password?: string
  sslMode: SslMode
}

/** Public connection fields — never includes password. */
export type SavedConnection = {
  id: string
  name: string
  host: string
  port: string
  database: string
  user: string
  sslMode: SslMode
  updatedAt?: string
}

/** @deprecated legacy single-connection localStorage key (migrated to vault) */
export const CONNECTION_STORAGE_KEY = "pgadmin.connection"

export const DEFAULT_CONNECTION: DbConnectionConfig = {
  name: "Local Postgres",
  host: "localhost",
  port: "5432",
  database: "postgres",
  user: "postgres",
  password: "postgres",
  sslMode: "disable",
}

export function buildConnectionString(config: DbConnectionConfig): string {
  const user = encodeURIComponent(config.user)
  const password = encodeURIComponent(config.password ?? "")
  const database = encodeURIComponent(config.database)
  const params = new URLSearchParams({ sslmode: config.sslMode })
  return `postgresql://${user}:${password}@${config.host}:${config.port}/${database}?${params}`
}

/** Read legacy plaintext localStorage connection (pre-F6.2). */
export function loadLegacyConnection(): DbConnectionConfig | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONNECTION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DbConnectionConfig
  } catch {
    return null
  }
}

export function clearLegacyConnection(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CONNECTION_STORAGE_KEY)
}

/** @deprecated use vault + /api/connections/active */
export function loadConnection(): DbConnectionConfig | null {
  return loadLegacyConnection()
}

/** @deprecated passwords must not be stored in localStorage */
export function saveConnection(_config: DbConnectionConfig): void {
  // no-op — secrets live in the server vault
}

export function clearConnection(): void {
  clearLegacyConnection()
}

export function connectionLabel(c: {
  name?: string
  user: string
  host: string
  port: string
  database: string
}): string {
  const title = c.name?.trim()
  const target = `${c.user}@${c.host}:${c.port}/${c.database}`
  return title ? `${title} · ${target}` : target
}
