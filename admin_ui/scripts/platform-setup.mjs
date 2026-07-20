/**
 * Bootstrap platform control database + migrations.
 *
 * Usage:
 *   npm run platform:setup
 *   (reads PG_MASTER_URL + PLATFORM_DATABASE_URL from .env.local / .env)
 */
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { Client } from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8")
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // ignore missing file
  }
}

loadEnvFile(join(__dirname, "../.env.local"))
loadEnvFile(join(__dirname, "../.env"))

function parseDbUrl(url) {
  const u = new URL(url)
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres"
  return {
    protocol: u.protocol,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || "5432",
    database,
    search: u.search,
  }
}

function buildUrl(parts, database) {
  const user = encodeURIComponent(parts.username)
  const pass = parts.password ? `:${encodeURIComponent(parts.password)}` : ""
  return `${parts.protocol}//${user}${pass}@${parts.host}:${parts.port}/${encodeURIComponent(database)}${parts.search}`
}

function getMasterUrl() {
  return (
    process.env.PG_MASTER_URL?.trim() ||
    process.env.MASTER_DATABASE_URL?.trim() ||
    null
  )
}

async function ensureDatabase(platformUrl, masterUrl) {
  const parts = parseDbUrl(platformUrl)
  const adminUrl =
    process.env.PLATFORM_ADMIN_URL?.trim() ||
    (masterUrl ? buildUrl(parseDbUrl(masterUrl), "postgres") : null) ||
    buildUrl(parts, "postgres")

  if (parts.database === "postgres") {
    console.log("PLATFORM_DATABASE_URL points at 'postgres' — skipping CREATE DATABASE")
    return
  }

  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  try {
    const exists = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [parts.database]
    )
    if (exists.rowCount) {
      console.log(`Database "${parts.database}" already exists`)
      return
    }
    const safeName = parts.database.replace(/"/g, '""')
    await admin.query(`CREATE DATABASE "${safeName}"`)
    console.log(`Created database "${parts.database}"`)
  } finally {
    await admin.end()
  }
}

async function applyMigrations(platformUrl) {
  const client = new Client({ connectionString: platformUrl })
  await client.connect()
  try {
    const dir = join(__dirname, "../db/migrations")
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8")
      console.log(`Applying ${file}…`)
      await client.query(sql)
    }
    console.log("Migrations applied")
  } finally {
    await client.end()
  }
}

async function verifyMaster(masterUrl) {
  const client = new Client({ connectionString: masterUrl })
  await client.connect()
  try {
    const res = await client.query(`SELECT current_database() AS db, version()`)
    const row = res.rows[0]
    console.log(`Master OK → database "${row.db}"`)
  } finally {
    await client.end()
  }
}

async function main() {
  const masterUrl = getMasterUrl()
  const platformUrl = process.env.PLATFORM_DATABASE_URL?.trim()

  if (!masterUrl) {
    console.error(
      "PG_MASTER_URL is required.\nExample:\n  PG_MASTER_URL=postgresql://postgres:postgres@localhost:5432/postgres"
    )
    process.exit(1)
  }
  if (!platformUrl) {
    console.error(
      "PLATFORM_DATABASE_URL is required.\nExample:\n  PLATFORM_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pgadmin_platform"
    )
    process.exit(1)
  }

  console.log("Platform setup starting…")
  console.log(`Master:   ${mask(masterUrl)}`)
  console.log(`Platform: ${mask(platformUrl)}`)

  await verifyMaster(masterUrl)
  await ensureDatabase(platformUrl, masterUrl)
  await applyMigrations(platformUrl)
  console.log("Done. Create projects in the UI to link or create databases.")
}

function mask(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`
  } catch {
    return "(invalid url)"
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
