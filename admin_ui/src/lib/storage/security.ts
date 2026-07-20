import type { Client } from "pg"
import {
  ensureStorageReady,
  getSetting,
  withProjectClient,
  writeAudit,
} from "@/lib/storage/db"
import type { StorageObject, StoragePolicy } from "@/lib/storage/schema"
import {
  deleteObjectBytes,
  getPresignedDownloadUrl,
} from "@/lib/storage/s3"

function mapPolicy(row: {
  id: string
  name: string
  bucket_id: string | null
  bucket_name?: string | null
  operation: StoragePolicy["operation"]
  definition: string
  enabled: boolean
  created_at: Date
  updated_at: Date
}): StoragePolicy {
  return {
    id: row.id,
    name: row.name,
    bucket_id: row.bucket_id,
    bucket_name: row.bucket_name ?? null,
    operation: row.operation,
    definition: row.definition,
    enabled: row.enabled,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

export async function listPolicies(
  projectId: string
): Promise<StoragePolicy[]> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `SELECT p.*, b.name AS bucket_name
       FROM storage.policies p
       LEFT JOIN storage.buckets b ON b.id = p.bucket_id
       ORDER BY p.name`
    )
    return res.rows.map(mapPolicy)
  })
}

export async function createPolicy(
  projectId: string,
  input: {
    name: string
    bucket_id?: string | null
    operation: StoragePolicy["operation"]
    definition?: string
    enabled?: boolean
  }
): Promise<StoragePolicy> {
  await ensureStorageReady(projectId)
  const name = input.name.trim()
  if (!name) throw new Error("Policy name is required")

  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `INSERT INTO storage.policies (name, bucket_id, operation, definition, enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name,
        input.bucket_id || null,
        input.operation,
        input.definition?.trim() || "allow",
        input.enabled !== false,
      ]
    )
    await writeAudit(client, {
      action: "policy.create",
      bucketId: input.bucket_id,
      details: { name, operation: input.operation },
    })
    return mapPolicy(res.rows[0])
  })
}

export async function updatePolicy(
  projectId: string,
  policyId: string,
  patch: {
    name?: string
    bucket_id?: string | null
    operation?: StoragePolicy["operation"]
    definition?: string
    enabled?: boolean
  }
): Promise<StoragePolicy> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const cur = await client.query(`SELECT * FROM storage.policies WHERE id = $1`, [
      policyId,
    ])
    if (!cur.rows[0]) throw new Error("Policy not found")
    const row = cur.rows[0]
    const res = await client.query(
      `UPDATE storage.policies SET
         name = $2,
         bucket_id = $3,
         operation = $4,
         definition = $5,
         enabled = $6,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        policyId,
        patch.name?.trim() ?? row.name,
        patch.bucket_id !== undefined ? patch.bucket_id : row.bucket_id,
        patch.operation ?? row.operation,
        patch.definition !== undefined ? patch.definition : row.definition,
        patch.enabled !== undefined ? patch.enabled : row.enabled,
      ]
    )
    await writeAudit(client, {
      action: "policy.update",
      details: { id: policyId },
    })
    return mapPolicy(res.rows[0])
  })
}

export async function deletePolicy(
  projectId: string,
  policyId: string
): Promise<void> {
  await ensureStorageReady(projectId)
  await withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `DELETE FROM storage.policies WHERE id = $1 RETURNING name`,
      [policyId]
    )
    if (!res.rows[0]) throw new Error("Policy not found")
    await writeAudit(client, {
      action: "policy.delete",
      details: { name: res.rows[0].name },
    })
  })
}

/**
 * Call optional content-scan webhook. Expects JSON:
 * { "ok": true } or { "ok": false, "reason": "..." }
 */
export async function runContentScan(
  projectId: string,
  client: Client,
  opts: {
    object: StorageObject
    bucketName: string
    body: Buffer
  }
): Promise<StorageObject> {
  const webhook =
    (await getSetting(client, "scan_webhook_url")) ||
    process.env.STORAGE_SCAN_WEBHOOK_URL?.trim() ||
    null

  if (!webhook) {
    await client.query(
      `UPDATE storage.objects SET status = 'ready', updated_at = now() WHERE id = $1`,
      [opts.object.id]
    )
    return { ...opts.object, status: "ready" }
  }

  let downloadUrl: string | null = null
  try {
    downloadUrl = await getPresignedDownloadUrl({
      projectId,
      logicalBucket: opts.bucketName,
      objectPath: opts.object.name,
      expiresIn: 600,
    })
  } catch {
    downloadUrl = null
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        project_id: projectId,
        bucket: opts.bucketName,
        object_id: opts.object.id,
        path: opts.object.name,
        mime_type: opts.object.mime_type,
        size: opts.object.size,
        download_url: downloadUrl,
        // small files: include base64 sample (first 64KB) for scanners that need bytes
        sample_base64:
          opts.body.length <= 64 * 1024
            ? opts.body.toString("base64")
            : null,
      }),
    })
    clearTimeout(timer)

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      allowed?: boolean
      reason?: string
    }
    const allowed =
      res.ok && (data.ok !== false && data.allowed !== false)

    if (!allowed) {
      try {
        await deleteObjectBytes({
          projectId,
          logicalBucket: opts.bucketName,
          objectPath: opts.object.name,
        })
      } catch {
        // ignore
      }
      await client.query(
        `UPDATE storage.objects
         SET status = 'rejected',
             metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [
          opts.object.id,
          JSON.stringify({
            scan_rejected: true,
            scan_reason: data.reason || `HTTP ${res.status}`,
          }),
        ]
      )
      await writeAudit(client, {
        action: "object.scan_rejected",
        bucketName: opts.bucketName,
        objectId: opts.object.id,
        objectPath: opts.object.name,
        details: { reason: data.reason || `HTTP ${res.status}` },
      })
      throw new Error(
        data.reason || "Content scan rejected this upload"
      )
    }

    await client.query(
      `UPDATE storage.objects SET status = 'ready', updated_at = now() WHERE id = $1`,
      [opts.object.id]
    )
    await writeAudit(client, {
      action: "object.scan_passed",
      bucketName: opts.bucketName,
      objectId: opts.object.id,
      objectPath: opts.object.name,
    })
    return { ...opts.object, status: "ready" }
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Content scan rejected")
    ) {
      throw err
    }
    // Fail open vs fail closed: quarantine on scanner errors
    await client.query(
      `UPDATE storage.objects
       SET status = 'quarantined',
           metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [
        opts.object.id,
        JSON.stringify({
          scan_error: err instanceof Error ? err.message : "scan failed",
        }),
      ]
    )
    await writeAudit(client, {
      action: "object.scan_error",
      bucketName: opts.bucketName,
      objectId: opts.object.id,
      objectPath: opts.object.name,
      details: {
        error: err instanceof Error ? err.message : "scan failed",
      },
    })
    return { ...opts.object, status: "quarantined" }
  }
}
