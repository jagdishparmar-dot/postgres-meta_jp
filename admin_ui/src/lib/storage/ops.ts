import JSZip from "jszip"
import {
  ensureStorageReady,
  getSetting,
  withProjectClient,
  writeAudit,
} from "@/lib/storage/db"
import type {
  StorageAuditEntry,
  StorageLifecycleRule,
} from "@/lib/storage/schema"
import {
  deleteObjectBytes,
  listPhysicalKeys,
} from "@/lib/storage/s3"
import { FOLDER_MARKER, uploadObject } from "@/lib/storage/service"

function mapLifecycle(row: {
  id: string
  bucket_id: string
  bucket_name?: string
  name: string
  prefix: string
  days: number
  action: "expire"
  enabled: boolean
  created_at: Date
  updated_at: Date
}): StorageLifecycleRule {
  return {
    id: row.id,
    bucket_id: row.bucket_id,
    bucket_name: row.bucket_name,
    name: row.name,
    prefix: row.prefix || "",
    days: Number(row.days),
    action: row.action,
    enabled: row.enabled,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

function mapAudit(row: {
  id: string
  action: string
  bucket_id: string | null
  bucket_name: string | null
  object_id: string | null
  object_path: string | null
  actor: string | null
  details: Record<string, unknown> | null
  created_at: Date
}): StorageAuditEntry {
  return {
    id: row.id,
    action: row.action,
    bucket_id: row.bucket_id,
    bucket_name: row.bucket_name,
    object_id: row.object_id,
    object_path: row.object_path,
    actor: row.actor,
    details: row.details || {},
    created_at: row.created_at.toISOString(),
  }
}

export async function getUsage(projectId: string) {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const buckets = await client.query<{
      id: string
      name: string
      object_count: string
      total_bytes: string
    }>(
      `SELECT b.id, b.name,
         count(o.id) FILTER (
           WHERE o.name NOT LIKE '%/${FOLDER_MARKER}'
             AND o.name <> '${FOLDER_MARKER}'
             AND COALESCE(o.status, 'ready') = 'ready'
         )::text AS object_count,
         coalesce(sum(o.size) FILTER (
           WHERE COALESCE(o.status, 'ready') = 'ready'
         ), 0)::text AS total_bytes
       FROM storage.buckets b
       LEFT JOIN storage.objects o ON o.bucket_id = b.id
       GROUP BY b.id, b.name
       ORDER BY b.name`
    )

    const quotaRaw = await getSetting(client, "quota_bytes")
    const quota_bytes = quotaRaw ? Number(quotaRaw) : null
    const byBucket = buckets.rows.map((r) => ({
      id: r.id,
      name: r.name,
      object_count: Number(r.object_count),
      total_bytes: Number(r.total_bytes),
    }))
    const total_bytes = byBucket.reduce((s, b) => s + b.total_bytes, 0)
    const total_objects = byBucket.reduce((s, b) => s + b.object_count, 0)

    return {
      buckets: byBucket,
      total_bytes,
      total_objects,
      quota_bytes:
        quota_bytes != null && Number.isFinite(quota_bytes) ? quota_bytes : null,
      quota_used_pct:
        quota_bytes && quota_bytes > 0
          ? Math.min(100, Math.round((total_bytes / quota_bytes) * 1000) / 10)
          : null,
    }
  })
}

export type OrphanReport = {
  bucket_id: string
  bucket_name: string
  db_orphans: { id: string; name: string; size: number }[]
  s3_orphans: { name: string }[]
}

export async function scanOrphans(
  projectId: string,
  bucketId?: string
): Promise<OrphanReport[]> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const buckets = await client.query<{ id: string; name: string }>(
      bucketId
        ? `SELECT id, name FROM storage.buckets WHERE id = $1`
        : `SELECT id, name FROM storage.buckets ORDER BY name`,
      bucketId ? [bucketId] : []
    )

    const reports: OrphanReport[] = []
    for (const bucket of buckets.rows) {
      const dbObjects = await client.query<{
        id: string
        name: string
        size: string
      }>(
        `SELECT id, name, size::text FROM storage.objects WHERE bucket_id = $1`,
        [bucket.id]
      )
      let s3Keys: string[] = []
      try {
        s3Keys = await listPhysicalKeys({
          projectId,
          logicalBucket: bucket.name,
        })
      } catch {
        s3Keys = []
      }

      const s3Set = new Set(s3Keys)
      const dbSet = new Set(dbObjects.rows.map((r) => r.name))

      reports.push({
        bucket_id: bucket.id,
        bucket_name: bucket.name,
        db_orphans: dbObjects.rows
          .filter((r) => !s3Set.has(r.name))
          .map((r) => ({
            id: r.id,
            name: r.name,
            size: Number(r.size),
          })),
        s3_orphans: s3Keys
          .filter((k) => !dbSet.has(k))
          .map((name) => ({ name })),
      })
    }
    return reports
  })
}

export async function repairOrphans(
  projectId: string,
  input: {
    bucketId: string
    deleteDbOrphans?: boolean
    deleteS3Orphans?: boolean
  }
): Promise<{ deleted_db: number; deleted_s3: number }> {
  await ensureStorageReady(projectId)
  const reports = await scanOrphans(projectId, input.bucketId)
  const report = reports[0]
  if (!report) throw new Error("Bucket not found")

  let deleted_db = 0
  let deleted_s3 = 0

  await withProjectClient(projectId, async (client) => {
    if (input.deleteDbOrphans) {
      for (const orphan of report.db_orphans) {
        await client.query(`DELETE FROM storage.objects WHERE id = $1`, [
          orphan.id,
        ])
        deleted_db += 1
      }
    }
    if (input.deleteS3Orphans) {
      for (const orphan of report.s3_orphans) {
        try {
          await deleteObjectBytes({
            projectId,
            logicalBucket: report.bucket_name,
            objectPath: orphan.name,
          })
          deleted_s3 += 1
        } catch {
          // ignore
        }
      }
    }
    await writeAudit(client, {
      action: "orphans.repair",
      bucketId: input.bucketId,
      bucketName: report.bucket_name,
      details: {
        deleted_db,
        deleted_s3,
        deleteDbOrphans: Boolean(input.deleteDbOrphans),
        deleteS3Orphans: Boolean(input.deleteS3Orphans),
      },
    })
  })

  return { deleted_db, deleted_s3 }
}

export async function importZip(
  projectId: string,
  input: {
    bucketId: string
    prefix?: string
    zip: Buffer
  }
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  await ensureStorageReady(projectId)
  const zip = await JSZip.loadAsync(input.zip)
  const prefix = input.prefix
    ? input.prefix.replace(/^\/+/, "").replace(/\/?$/, "/")
    : ""

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir) {
      skipped += 1
      continue
    }
    const name = entry.name.replace(/^\/+/, "")
    if (!name || name.includes("..")) {
      skipped += 1
      continue
    }
    try {
      const body = Buffer.from(await entry.async("uint8array"))
      const mime =
        name.endsWith(".png")
          ? "image/png"
          : name.endsWith(".jpg") || name.endsWith(".jpeg")
            ? "image/jpeg"
            : name.endsWith(".gif")
              ? "image/gif"
              : name.endsWith(".webp")
                ? "image/webp"
                : name.endsWith(".pdf")
                  ? "application/pdf"
                  : name.endsWith(".json")
                    ? "application/json"
                    : name.endsWith(".txt") || name.endsWith(".md")
                      ? "text/plain"
                      : "application/octet-stream"

      await uploadObject(projectId, {
        bucketId: input.bucketId,
        path: `${prefix}${name}`,
        body,
        contentType: mime,
      })
      imported += 1
    } catch (err) {
      errors.push(
        `${name}: ${err instanceof Error ? err.message : "import failed"}`
      )
    }
  }

  await withProjectClient(projectId, async (client) => {
    const bucket = await client.query<{ name: string }>(
      `SELECT name FROM storage.buckets WHERE id = $1`,
      [input.bucketId]
    )
    await writeAudit(client, {
      action: "zip.import",
      bucketId: input.bucketId,
      bucketName: bucket.rows[0]?.name,
      details: { imported, skipped, errors: errors.length },
    })
  })

  return { imported, skipped, errors }
}

export async function listLifecycleRules(
  projectId: string
): Promise<StorageLifecycleRule[]> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `SELECT r.*, b.name AS bucket_name
       FROM storage.lifecycle_rules r
       JOIN storage.buckets b ON b.id = r.bucket_id
       ORDER BY b.name, r.name`
    )
    return res.rows.map(mapLifecycle)
  })
}

export async function createLifecycleRule(
  projectId: string,
  input: {
    bucket_id: string
    name: string
    days: number
    prefix?: string
    enabled?: boolean
  }
): Promise<StorageLifecycleRule> {
  await ensureStorageReady(projectId)
  if (!input.name.trim()) throw new Error("Rule name is required")
  if (!input.days || input.days < 1) throw new Error("Days must be >= 1")

  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `INSERT INTO storage.lifecycle_rules (bucket_id, name, prefix, days, action, enabled)
       VALUES ($1, $2, $3, $4, 'expire', $5)
       RETURNING *`,
      [
        input.bucket_id,
        input.name.trim(),
        input.prefix?.replace(/^\/+/, "") || "",
        input.days,
        input.enabled !== false,
      ]
    )
    await writeAudit(client, {
      action: "lifecycle.create",
      bucketId: input.bucket_id,
      details: { name: input.name, days: input.days },
    })
    return mapLifecycle(res.rows[0])
  })
}

export async function updateLifecycleRule(
  projectId: string,
  ruleId: string,
  patch: {
    name?: string
    days?: number
    prefix?: string
    enabled?: boolean
  }
): Promise<StorageLifecycleRule> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const cur = await client.query(
      `SELECT * FROM storage.lifecycle_rules WHERE id = $1`,
      [ruleId]
    )
    if (!cur.rows[0]) throw new Error("Lifecycle rule not found")
    const row = cur.rows[0]
    const res = await client.query(
      `UPDATE storage.lifecycle_rules SET
         name = $2,
         days = $3,
         prefix = $4,
         enabled = $5,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        ruleId,
        patch.name?.trim() ?? row.name,
        patch.days ?? row.days,
        patch.prefix !== undefined
          ? patch.prefix.replace(/^\/+/, "")
          : row.prefix,
        patch.enabled !== undefined ? patch.enabled : row.enabled,
      ]
    )
    return mapLifecycle(res.rows[0])
  })
}

export async function deleteLifecycleRule(
  projectId: string,
  ruleId: string
): Promise<void> {
  await ensureStorageReady(projectId)
  await withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `DELETE FROM storage.lifecycle_rules WHERE id = $1 RETURNING name, bucket_id`,
      [ruleId]
    )
    if (!res.rows[0]) throw new Error("Lifecycle rule not found")
    await writeAudit(client, {
      action: "lifecycle.delete",
      bucketId: res.rows[0].bucket_id,
      details: { name: res.rows[0].name },
    })
  })
}

export async function applyLifecycleRules(
  projectId: string,
  ruleId?: string
): Promise<{ deleted: number; rules_applied: number }> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const rules = await client.query<{
      id: string
      bucket_id: string
      bucket_name: string
      prefix: string
      days: number
    }>(
      ruleId
        ? `SELECT r.id, r.bucket_id, b.name AS bucket_name, r.prefix, r.days
           FROM storage.lifecycle_rules r
           JOIN storage.buckets b ON b.id = r.bucket_id
           WHERE r.id = $1 AND r.enabled = true`
        : `SELECT r.id, r.bucket_id, b.name AS bucket_name, r.prefix, r.days
           FROM storage.lifecycle_rules r
           JOIN storage.buckets b ON b.id = r.bucket_id
           WHERE r.enabled = true`,
      ruleId ? [ruleId] : []
    )

    let deleted = 0
    for (const rule of rules.rows) {
      const prefix = rule.prefix || ""
      const objs = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM storage.objects
         WHERE bucket_id = $1
           AND created_at < now() - ($2::text || ' days')::interval
           AND ($3 = '' OR name LIKE $3 || '%')
           AND name NOT LIKE '%/${FOLDER_MARKER}'
           AND name <> '${FOLDER_MARKER}'`,
        [rule.bucket_id, String(rule.days), prefix]
      )

      for (const obj of objs.rows) {
        try {
          await deleteObjectBytes({
            projectId,
            logicalBucket: rule.bucket_name,
            objectPath: obj.name,
          })
        } catch {
          // ignore
        }
        await client.query(`DELETE FROM storage.objects WHERE id = $1`, [
          obj.id,
        ])
        deleted += 1
      }
    }

    await writeAudit(client, {
      action: "lifecycle.apply",
      details: { deleted, rules_applied: rules.rows.length, ruleId },
    })

    return { deleted, rules_applied: rules.rows.length }
  })
}

export async function listAuditLog(
  projectId: string,
  opts?: { limit?: number; action?: string }
): Promise<StorageAuditEntry[]> {
  await ensureStorageReady(projectId)
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `SELECT * FROM storage.audit_log
       WHERE ($1::text IS NULL OR action = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [opts?.action || null, limit]
    )
    return res.rows.map(mapAudit)
  })
}
