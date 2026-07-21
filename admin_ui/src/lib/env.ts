const WEAK_PASSWORDS = new Set([
  "admin",
  "password",
  "postgres",
  "change-me-to-a-long-secret",
  "changeme",
])

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true
  if (process.env.COOKIE_SECURE === "false") return false
  return isProduction()
}

/** Auth is mandatory in production; optional in development when env vars are set. */
export function isAdminAuthRequired(): boolean {
  if (isProduction()) return true
  const id = process.env.ADMIN_ID?.trim()
  const password = process.env.ADMIN_PASSWORD?.trim()
  return Boolean(id && password)
}

export function validateProductionEnv(): void {
  if (!isProduction()) return

  const errors: string[] = []

  const adminId = process.env.ADMIN_ID?.trim()
  const adminPassword = process.env.ADMIN_PASSWORD?.trim()
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim()

  if (!adminId) errors.push("ADMIN_ID is required in production")
  if (!adminPassword || adminPassword.length < 16) {
    errors.push("ADMIN_PASSWORD must be at least 16 characters in production")
  } else if (WEAK_PASSWORDS.has(adminPassword.toLowerCase())) {
    errors.push("ADMIN_PASSWORD is too weak for production")
  }

  if (!sessionSecret || sessionSecret.length < 32) {
    errors.push("ADMIN_SESSION_SECRET must be at least 32 characters in production")
  }

  if (!process.env.PG_META_URL?.trim()) {
    errors.push("PG_META_URL is required in production")
  }
  if (!process.env.PG_MASTER_URL?.trim()) {
    errors.push("PG_MASTER_URL is required in production")
  }
  if (!process.env.PLATFORM_DATABASE_URL?.trim()) {
    errors.push("PLATFORM_DATABASE_URL is required in production")
  }

  const vaultKey = process.env.CONNECTION_VAULT_KEY?.trim()
  if (!vaultKey || vaultKey.length < 16) {
    errors.push(
      "CONNECTION_VAULT_KEY must be set (min 16 chars) in production — do not rely on auto-generated .data/vault.key"
    )
  }

  if (errors.length > 0) {
    throw new Error(
      `Production environment validation failed:\n- ${errors.join("\n- ")}`
    )
  }
}
