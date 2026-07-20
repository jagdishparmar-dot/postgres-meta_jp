import { Client } from "pg"
import { resolveProjectConnectionString } from "@/lib/platform/projects"
import { STORAGE_SCHEMA_SQL } from "@/lib/storage/schema"
import {
  ensurePhysicalBucket,
  isStorageConfigured,
} from "@/lib/storage/s3"

export async function withProjectClient<T>(
  projectId: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const resolved = await resolveProjectConnectionString(projectId)
  if (!resolved) throw new Error("Project not found or archived.")
  const client = new Client({ connectionString: resolved.connectionString })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function ensureStorageReady(projectId: string): Promise<{
  physicalBucket: string
}> {
  if (!isStorageConfigured()) {
    throw new Error(
      "Storage is not configured. Set RUSTFS_ENDPOINT, RUSTFS_ACCESS_KEY, RUSTFS_SECRET_KEY."
    )
  }

  return withProjectClient(projectId, async (client) => {
    await client.query(STORAGE_SCHEMA_SQL)
    const physical = await ensurePhysicalBucket(projectId)
    await client.query(
      `INSERT INTO storage.settings (key, value) VALUES ('physical_bucket', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [physical]
    )
    return { physicalBucket: physical }
  })
}

export async function writeAudit(
  client: Client,
  entry: {
    action: string
    bucketId?: string | null
    bucketName?: string | null
    objectId?: string | null
    objectPath?: string | null
    actor?: string | null
    details?: Record<string, unknown>
  }
): Promise<void> {
  await client.query(
    `INSERT INTO storage.audit_log
       (action, bucket_id, bucket_name, object_id, object_path, actor, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      entry.action,
      entry.bucketId ?? null,
      entry.bucketName ?? null,
      entry.objectId ?? null,
      entry.objectPath ?? null,
      entry.actor ?? "admin",
      JSON.stringify(entry.details || {}),
    ]
  )
}

export async function getSetting(
  client: Client,
  key: string
): Promise<string | null> {
  const res = await client.query<{ value: string }>(
    `SELECT value FROM storage.settings WHERE key = $1`,
    [key]
  )
  return res.rows[0]?.value ?? null
}

export async function setSetting(
  client: Client,
  key: string,
  value: string
): Promise<void> {
  await client.query(
    `INSERT INTO storage.settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  )
}
