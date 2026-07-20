import type { Client } from "pg"
import {
  ensureStorageReady,
  getSetting,
  setSetting,
  withProjectClient,
  writeAudit,
} from "@/lib/storage/db"
import type { StorageBucket, StorageObject } from "@/lib/storage/schema"
import {
  copyObjectBytes,
  deleteObjectBytes,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  isStorageConfigured,
  physicalBucketName,
  publicObjectUrl,
  putObjectBytes,
} from "@/lib/storage/s3"
import { runContentScan } from "@/lib/storage/security"

export { ensureStorageReady, withProjectClient }

export const FOLDER_MARKER = ".keep"

function mapBucket(row: {
  id: string
  name: string
  public: boolean
  file_size_limit: string | number | null
  allowed_mime_types: string[] | null
  created_at: Date
  updated_at: Date
  object_count?: string | number
  total_bytes?: string | number
}): StorageBucket {
  return {
    id: row.id,
    name: row.name,
    public: row.public,
    file_size_limit:
      row.file_size_limit == null ? null : Number(row.file_size_limit),
    allowed_mime_types: row.allowed_mime_types,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    object_count:
      row.object_count == null ? undefined : Number(row.object_count),
    total_bytes: row.total_bytes == null ? undefined : Number(row.total_bytes),
  }
}

function mapObject(row: {
  id: string
  bucket_id: string
  bucket_name?: string
  name: string
  owner: string | null
  mime_type: string | null
  size: string | number
  etag: string | null
  metadata: Record<string, unknown> | null
  status?: string
  created_at: Date
  updated_at: Date
}): StorageObject {
  return {
    id: row.id,
    bucket_id: row.bucket_id,
    bucket_name: row.bucket_name,
    name: row.name,
    owner: row.owner,
    mime_type: row.mime_type,
    size: Number(row.size || 0),
    etag: row.etag,
    metadata: row.metadata || {},
    status: row.status || "ready",
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

function normalizePrefix(prefix?: string | null): string {
  if (!prefix) return ""
  const clean = prefix.replace(/^\/+/, "").replace(/\/+$/, "")
  return clean ? `${clean}/` : ""
}

function isFolderMarker(path: string): boolean {
  return path === FOLDER_MARKER || path.endsWith(`/${FOLDER_MARKER}`)
}

function mimeAllowed(
  allowed: string[] | null | undefined,
  contentType: string
): boolean {
  if (!allowed || allowed.length === 0) return true
  const ct = contentType.toLowerCase()
  return allowed.some((pattern) => {
    const p = pattern.toLowerCase().trim()
    if (!p) return false
    if (p.endsWith("/*")) return ct.startsWith(p.slice(0, -1))
    return ct === p
  })
}

async function assertPolicyAllows(
  client: Client,
  opts: {
    bucketId: string
    operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
  }
): Promise<void> {
  const res = await client.query<{
    name: string
    definition: string
    operation: string
  }>(
    `SELECT name, definition, operation FROM storage.policies
     WHERE enabled = true
       AND (bucket_id IS NULL OR bucket_id = $1)
       AND (operation = 'ALL' OR operation = $2)`,
    [opts.bucketId, opts.operation]
  )
  // Deny rules: definition starting with "deny" blocks the operation
  for (const row of res.rows) {
    const def = row.definition.trim().toLowerCase()
    if (def.startsWith("deny") || def === "false" || def === "block") {
      throw new Error(
        `Storage policy “${row.name}” denies ${opts.operation} on this bucket`
      )
    }
  }
}

export async function listBuckets(projectId: string): Promise<StorageBucket[]> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query({
      text: `SELECT b.*,
              (SELECT count(*) FROM storage.objects o
                WHERE o.bucket_id = b.id
                  AND o.name NOT LIKE '%/${FOLDER_MARKER}'
                  AND o.name <> '${FOLDER_MARKER}'
                  AND COALESCE(o.status, 'ready') <> 'rejected') AS object_count,
              (SELECT coalesce(sum(o.size), 0) FROM storage.objects o
                WHERE o.bucket_id = b.id
                  AND COALESCE(o.status, 'ready') = 'ready') AS total_bytes
       FROM storage.buckets b
       ORDER BY b.name`,
    })
    return res.rows.map(mapBucket)
  })
}

export async function getBucket(
  projectId: string,
  bucketId: string
): Promise<StorageBucket | null> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `SELECT b.*,
         (SELECT count(*) FROM storage.objects o
           WHERE o.bucket_id = b.id
             AND o.name NOT LIKE '%/${FOLDER_MARKER}'
             AND o.name <> '${FOLDER_MARKER}') AS object_count
       FROM storage.buckets b WHERE b.id = $1`,
      [bucketId]
    )
    return res.rows[0] ? mapBucket(res.rows[0]) : null
  })
}

export async function createBucket(
  projectId: string,
  input: {
    name: string
    public?: boolean
    file_size_limit?: number | null
    allowed_mime_types?: string[] | null
  }
): Promise<StorageBucket> {
  await ensureStorageReady(projectId)
  const name = input.name.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(name)) {
    throw new Error(
      "Invalid bucket name. Use 3–63 chars: lowercase letters, numbers, dots, hyphens."
    )
  }

  return withProjectClient(projectId, async (client) => {
    const res = await client.query(
      `INSERT INTO storage.buckets (name, public, file_size_limit, allowed_mime_types)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name,
        Boolean(input.public),
        input.file_size_limit ?? null,
        input.allowed_mime_types?.length ? input.allowed_mime_types : null,
      ]
    )
    await writeAudit(client, {
      action: "bucket.create",
      bucketId: res.rows[0].id,
      bucketName: name,
    })
    return mapBucket({ ...res.rows[0], object_count: 0, total_bytes: 0 })
  })
}

export async function updateBucket(
  projectId: string,
  bucketId: string,
  patch: {
    public?: boolean
    file_size_limit?: number | null
    allowed_mime_types?: string[] | null
  }
): Promise<StorageBucket> {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const current = await client.query(`SELECT * FROM storage.buckets WHERE id = $1`, [
      bucketId,
    ])
    if (!current.rows[0]) throw new Error("Bucket not found")

    const nextPublic =
      patch.public !== undefined ? Boolean(patch.public) : current.rows[0].public
    const nextLimit =
      patch.file_size_limit !== undefined
        ? patch.file_size_limit
        : current.rows[0].file_size_limit
    const nextMimes =
      patch.allowed_mime_types !== undefined
        ? patch.allowed_mime_types?.length
          ? patch.allowed_mime_types
          : null
        : current.rows[0].allowed_mime_types

    const res = await client.query(
      `UPDATE storage.buckets
       SET public = $2,
           file_size_limit = $3,
           allowed_mime_types = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [bucketId, nextPublic, nextLimit, nextMimes]
    )
    await writeAudit(client, {
      action: "bucket.update",
      bucketId,
      bucketName: res.rows[0].name,
      details: { public: nextPublic },
    })
    return mapBucket(res.rows[0])
  })
}

export async function deleteBucket(
  projectId: string,
  bucketId: string
): Promise<void> {
  await ensureStorageReady(projectId)
  await withProjectClient(projectId, async (client) => {
    const bucket = await client.query<{ name: string }>(
      `SELECT name FROM storage.buckets WHERE id = $1`,
      [bucketId]
    )
    if (!bucket.rows[0]) throw new Error("Bucket not found")

    const objects = await client.query<{ name: string }>(
      `SELECT name FROM storage.objects WHERE bucket_id = $1`,
      [bucketId]
    )
    for (const obj of objects.rows) {
      try {
        await deleteObjectBytes({
          projectId,
          logicalBucket: bucket.rows[0].name,
          objectPath: obj.name,
        })
      } catch {
        // continue
      }
    }

    await client.query(`DELETE FROM storage.buckets WHERE id = $1`, [bucketId])
    await writeAudit(client, {
      action: "bucket.delete",
      bucketId,
      bucketName: bucket.rows[0].name,
      details: { objects: objects.rows.length },
    })
  })
}

export type BrowseResult = {
  prefix: string
  folders: { name: string; prefix: string }[]
  objects: StorageObject[]
}

export async function browseObjects(
  projectId: string,
  bucketId: string,
  opts?: { prefix?: string }
): Promise<BrowseResult> {
  await ensureStorageReady(projectId)
  const prefix = normalizePrefix(opts?.prefix)

  return withProjectClient(projectId, async (client) => {
    await assertPolicyAllows(client, { bucketId, operation: "SELECT" })
    const res = await client.query(
      `SELECT o.*, b.name AS bucket_name
       FROM storage.objects o
       JOIN storage.buckets b ON b.id = o.bucket_id
       WHERE o.bucket_id = $1
         AND ($2 = '' OR o.name LIKE $2 || '%')
         AND COALESCE(o.status, 'ready') <> 'rejected'
       ORDER BY o.name`,
      [bucketId, prefix]
    )

    const folderSet = new Map<string, string>()
    const objects: StorageObject[] = []

    for (const row of res.rows) {
      const fullName: string = row.name
      if (!fullName.startsWith(prefix)) continue
      const rest = fullName.slice(prefix.length)
      if (!rest) continue

      const slash = rest.indexOf("/")
      if (slash >= 0) {
        const folderName = rest.slice(0, slash)
        if (folderName && !folderSet.has(folderName)) {
          folderSet.set(folderName, `${prefix}${folderName}/`)
        }
        continue
      }

      if (isFolderMarker(fullName)) continue
      objects.push(mapObject(row))
    }

    return {
      prefix,
      folders: [...folderSet.entries()].map(([name, folderPrefix]) => ({
        name,
        prefix: folderPrefix,
      })),
      objects,
    }
  })
}

export async function listObjects(
  projectId: string,
  bucketId: string,
  opts?: { prefix?: string }
): Promise<StorageObject[]> {
  const browse = await browseObjects(projectId, bucketId, opts)
  return browse.objects
}

export async function createFolder(
  projectId: string,
  input: { bucketId: string; prefix?: string; name: string }
): Promise<{ prefix: string }> {
  const folderName = input.name.trim().replace(/\/+/g, "").replace(/^\.+/, "")
  if (!folderName || /[^a-zA-Z0-9._\- ]/.test(folderName)) {
    throw new Error(
      "Invalid folder name. Use letters, numbers, spaces, dots, hyphens, underscores."
    )
  }
  const base = normalizePrefix(input.prefix)
  const folderPrefix = `${base}${folderName}/`
  const markerPath = `${folderPrefix}${FOLDER_MARKER}`

  await uploadObject(projectId, {
    bucketId: input.bucketId,
    path: markerPath,
    body: Buffer.alloc(0),
    contentType: "application/x-directory",
  })

  return { prefix: folderPrefix }
}

export async function deletePrefix(
  projectId: string,
  input: { bucketId: string; prefix: string }
): Promise<{ deleted: number }> {
  await ensureStorageReady(projectId)
  const prefix = normalizePrefix(input.prefix)
  if (!prefix) throw new Error("Prefix is required for bulk delete")

  return withProjectClient(projectId, async (client) => {
    await assertPolicyAllows(client, {
      bucketId: input.bucketId,
      operation: "DELETE",
    })
    const bucket = await client.query<{ name: string }>(
      `SELECT name FROM storage.buckets WHERE id = $1`,
      [input.bucketId]
    )
    if (!bucket.rows[0]) throw new Error("Bucket not found")

    const objects = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM storage.objects
       WHERE bucket_id = $1 AND name LIKE $2 || '%'`,
      [input.bucketId, prefix]
    )

    for (const obj of objects.rows) {
      try {
        await deleteObjectBytes({
          projectId,
          logicalBucket: bucket.rows[0].name,
          objectPath: obj.name,
        })
      } catch {
        // ignore
      }
    }

    await client.query(
      `DELETE FROM storage.objects WHERE bucket_id = $1 AND name LIKE $2 || '%'`,
      [input.bucketId, prefix]
    )
    await writeAudit(client, {
      action: "prefix.delete",
      bucketId: input.bucketId,
      bucketName: bucket.rows[0].name,
      objectPath: prefix,
      details: { deleted: objects.rows.length },
    })

    return { deleted: objects.rows.length }
  })
}

export async function uploadObject(
  projectId: string,
  input: {
    bucketId: string
    path: string
    body: Buffer
    contentType?: string
  }
): Promise<StorageObject> {
  await ensureStorageReady(projectId)
  const path = input.path.replace(/^\/+/, "").trim()
  if (!path) throw new Error("Object path is required")

  return withProjectClient(projectId, async (client) => {
    await assertPolicyAllows(client, {
      bucketId: input.bucketId,
      operation: "INSERT",
    })

    const bucket = await client.query<{
      id: string
      name: string
      public: boolean
      file_size_limit: string | null
      allowed_mime_types: string[] | null
    }>(`SELECT * FROM storage.buckets WHERE id = $1`, [input.bucketId])
    if (!bucket.rows[0]) throw new Error("Bucket not found")

    const contentType = input.contentType || "application/octet-stream"
    const limit = bucket.rows[0].file_size_limit
    if (limit != null && input.body.length > Number(limit)) {
      throw new Error(`File exceeds bucket size limit (${limit} bytes)`)
    }
    if (
      !isFolderMarker(path) &&
      !mimeAllowed(bucket.rows[0].allowed_mime_types, contentType)
    ) {
      throw new Error(
        `MIME type “${contentType}” is not allowed for this bucket`
      )
    }

    // Quota check
    const quotaRaw = await getSetting(client, "quota_bytes")
    if (quotaRaw) {
      const quota = Number(quotaRaw)
      if (Number.isFinite(quota) && quota > 0) {
        const used = await client.query<{ sum: string }>(
          `SELECT coalesce(sum(size), 0)::text AS sum FROM storage.objects
           WHERE COALESCE(status, 'ready') = 'ready'`
        )
        if (Number(used.rows[0]?.sum || 0) + input.body.length > quota) {
          throw new Error(
            `Upload would exceed project storage quota (${quota} bytes)`
          )
        }
      }
    }

    const put = await putObjectBytes({
      projectId,
      logicalBucket: bucket.rows[0].name,
      objectPath: path,
      body: input.body,
      contentType,
    })

    const needsScan =
      !isFolderMarker(path) &&
      Boolean(
        process.env.STORAGE_SCAN_WEBHOOK_URL?.trim() ||
          (await getSetting(client, "scan_webhook_url"))
      )

    const res = await client.query(
      `INSERT INTO storage.objects (bucket_id, name, mime_type, size, etag, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (bucket_id, name) DO UPDATE SET
         mime_type = EXCLUDED.mime_type,
         size = EXCLUDED.size,
         etag = EXCLUDED.etag,
         metadata = EXCLUDED.metadata,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING *`,
      [
        input.bucketId,
        path,
        contentType,
        input.body.length,
        put.etag || null,
        JSON.stringify({
          physical_bucket: put.physicalBucket,
          key: put.key,
        }),
        needsScan ? "scanning" : "ready",
      ]
    )

    let object = mapObject({
      ...res.rows[0],
      bucket_name: bucket.rows[0].name,
    })

    if (needsScan) {
      object = await runContentScan(projectId, client, {
        object,
        bucketName: bucket.rows[0].name,
        body: input.body,
      })
    }

    await writeAudit(client, {
      action: "object.upload",
      bucketId: input.bucketId,
      bucketName: bucket.rows[0].name,
      objectId: object.id,
      objectPath: path,
      details: { size: object.size, status: object.status },
    })

    return object
  })
}

export async function deleteObject(
  projectId: string,
  objectId: string
): Promise<void> {
  await ensureStorageReady(projectId)
  await withProjectClient(projectId, async (client) => {
    const res = await client.query<{
      name: string
      bucket_id: string
      bucket_name: string
    }>(
      `SELECT o.name, o.bucket_id, b.name AS bucket_name
       FROM storage.objects o
       JOIN storage.buckets b ON b.id = o.bucket_id
       WHERE o.id = $1`,
      [objectId]
    )
    const row = res.rows[0]
    if (!row) throw new Error("Object not found")

    await assertPolicyAllows(client, {
      bucketId: row.bucket_id,
      operation: "DELETE",
    })

    try {
      await deleteObjectBytes({
        projectId,
        logicalBucket: row.bucket_name,
        objectPath: row.name,
      })
    } catch {
      // ignore
    }

    await client.query(`DELETE FROM storage.objects WHERE id = $1`, [objectId])
    await writeAudit(client, {
      action: "object.delete",
      bucketId: row.bucket_id,
      bucketName: row.bucket_name,
      objectId,
      objectPath: row.name,
    })
  })
}

async function loadObjectRow(
  client: Client,
  objectId: string
): Promise<{
  object: StorageObject
  bucketId: string
  bucketName: string
  isPublic: boolean
}> {
  const res = await client.query(
    `SELECT o.*, b.id AS bucket_uuid, b.name AS bucket_name, b.public AS bucket_public
     FROM storage.objects o
     JOIN storage.buckets b ON b.id = o.bucket_id
     WHERE o.id = $1`,
    [objectId]
  )
  if (!res.rows[0]) throw new Error("Object not found")
  return {
    object: mapObject(res.rows[0]),
    bucketId: res.rows[0].bucket_uuid,
    bucketName: res.rows[0].bucket_name,
    isPublic: Boolean(res.rows[0].bucket_public),
  }
}

export async function copyObject(
  projectId: string,
  input: { objectId: string; toPath: string }
): Promise<StorageObject> {
  await ensureStorageReady(projectId)
  const toPath = input.toPath.replace(/^\/+/, "").trim()
  if (!toPath) throw new Error("Destination path is required")

  return withProjectClient(projectId, async (client) => {
    const src = await loadObjectRow(client, input.objectId)
    await assertPolicyAllows(client, {
      bucketId: src.bucketId,
      operation: "INSERT",
    })
    if (src.object.name === toPath) {
      throw new Error("Destination path must differ from source")
    }

    const copied = await copyObjectBytes({
      projectId,
      logicalBucket: src.bucketName,
      fromPath: src.object.name,
      toPath,
    })

    const res = await client.query(
      `INSERT INTO storage.objects (bucket_id, name, mime_type, size, etag, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'ready')
       ON CONFLICT (bucket_id, name) DO UPDATE SET
         mime_type = EXCLUDED.mime_type,
         size = EXCLUDED.size,
         etag = EXCLUDED.etag,
         metadata = EXCLUDED.metadata,
         updated_at = now()
       RETURNING *`,
      [
        src.bucketId,
        toPath,
        src.object.mime_type,
        src.object.size,
        src.object.etag,
        JSON.stringify({
          physical_bucket: copied.physicalBucket,
          key: copied.key,
          copied_from: src.object.name,
        }),
      ]
    )
    const object = mapObject({ ...res.rows[0], bucket_name: src.bucketName })
    await writeAudit(client, {
      action: "object.copy",
      bucketId: src.bucketId,
      bucketName: src.bucketName,
      objectId: object.id,
      objectPath: toPath,
      details: { from: src.object.name },
    })
    return object
  })
}

export async function moveObject(
  projectId: string,
  input: { objectId: string; toPath: string }
): Promise<StorageObject> {
  await ensureStorageReady(projectId)
  const toPath = input.toPath.replace(/^\/+/, "").trim()
  if (!toPath) throw new Error("Destination path is required")

  return withProjectClient(projectId, async (client) => {
    const src = await loadObjectRow(client, input.objectId)
    await assertPolicyAllows(client, {
      bucketId: src.bucketId,
      operation: "UPDATE",
    })
    if (src.object.name === toPath) {
      throw new Error("Destination path must differ from source")
    }

    await copyObjectBytes({
      projectId,
      logicalBucket: src.bucketName,
      fromPath: src.object.name,
      toPath,
    })

    try {
      await deleteObjectBytes({
        projectId,
        logicalBucket: src.bucketName,
        objectPath: src.object.name,
      })
    } catch {
      // ignore
    }

    const physical = physicalBucketName(projectId)
    const res = await client.query(
      `UPDATE storage.objects
       SET name = $2,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{key}',
             to_jsonb($3::text)
           ),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [input.objectId, toPath, `${src.bucketName}/${toPath}`]
    )
    await client.query(
      `UPDATE storage.objects
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{physical_bucket}', to_jsonb($2::text))
       WHERE id = $1`,
      [input.objectId, physical]
    )

    await writeAudit(client, {
      action: "object.move",
      bucketId: src.bucketId,
      bucketName: src.bucketName,
      objectId: input.objectId,
      objectPath: toPath,
      details: { from: src.object.name },
    })

    return mapObject({ ...res.rows[0], bucket_name: src.bucketName })
  })
}

export async function getObjectDownloadUrl(
  projectId: string,
  objectId: string,
  opts?: { expiresIn?: number }
): Promise<{
  url: string
  expiresIn: number
  publicUrl: string | null
  object: StorageObject
}> {
  await ensureStorageReady(projectId)
  const expiresIn = Math.min(
    Math.max(opts?.expiresIn ?? 3600, 60),
    7 * 24 * 3600
  )

  return withProjectClient(projectId, async (client) => {
    const src = await loadObjectRow(client, objectId)
    await assertPolicyAllows(client, {
      bucketId: src.bucketId,
      operation: "SELECT",
    })
    if (src.object.status === "rejected" || src.object.status === "scanning") {
      throw new Error(`Object is not available (status: ${src.object.status})`)
    }
    const url = await getPresignedDownloadUrl({
      projectId,
      logicalBucket: src.bucketName,
      objectPath: src.object.name,
      expiresIn,
    })
    const pub = src.isPublic
      ? publicObjectUrl(src.bucketName, src.object.name, projectId) ||
        `/api/platform/projects/${projectId}/storage/public/${src.bucketName}/${src.object.name}`
      : null
    return { url, expiresIn, publicUrl: pub, object: src.object }
  })
}

export async function getObjectUploadUrl(
  projectId: string,
  input: {
    bucketId: string
    path: string
    contentType?: string
    expiresIn?: number
  }
): Promise<{ url: string; expiresIn: number; path: string }> {
  await ensureStorageReady(projectId)
  const path = input.path.replace(/^\/+/, "").trim()
  if (!path) throw new Error("Object path is required")
  const expiresIn = Math.min(
    Math.max(input.expiresIn ?? 3600, 60),
    7 * 24 * 3600
  )

  return withProjectClient(projectId, async (client) => {
    await assertPolicyAllows(client, {
      bucketId: input.bucketId,
      operation: "INSERT",
    })
    const bucket = await client.query<{ name: string }>(
      `SELECT name FROM storage.buckets WHERE id = $1`,
      [input.bucketId]
    )
    if (!bucket.rows[0]) throw new Error("Bucket not found")

    const url = await getPresignedUploadUrl({
      projectId,
      logicalBucket: bucket.rows[0].name,
      objectPath: path,
      contentType: input.contentType,
      expiresIn,
    })
    return { url, expiresIn, path }
  })
}

export async function getStorageSettings(projectId: string) {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    const res = await client.query<{ key: string; value: string }>(
      `SELECT key, value FROM storage.settings`
    )
    const map = Object.fromEntries(res.rows.map((r) => [r.key, r.value]))
    return {
      physical_bucket: map.physical_bucket || null,
      quota_bytes: map.quota_bytes ? Number(map.quota_bytes) : null,
      scan_webhook_url:
        map.scan_webhook_url ||
        process.env.STORAGE_SCAN_WEBHOOK_URL?.trim() ||
        null,
      scan_webhook_from_env: Boolean(
        process.env.STORAGE_SCAN_WEBHOOK_URL?.trim()
      ),
      public_url_base:
        process.env.RUSTFS_PUBLIC_URL?.trim() ||
        process.env.S3_PUBLIC_URL?.trim() ||
        null,
    }
  })
}

export async function updateStorageSettings(
  projectId: string,
  patch: { quota_bytes?: number | null; scan_webhook_url?: string | null }
) {
  await ensureStorageReady(projectId)
  return withProjectClient(projectId, async (client) => {
    if (patch.quota_bytes !== undefined) {
      if (patch.quota_bytes == null) {
        await client.query(
          `DELETE FROM storage.settings WHERE key = 'quota_bytes'`
        )
      } else {
        await setSetting(client, "quota_bytes", String(patch.quota_bytes))
      }
    }
    if (patch.scan_webhook_url !== undefined) {
      if (!patch.scan_webhook_url?.trim()) {
        await client.query(
          `DELETE FROM storage.settings WHERE key = 'scan_webhook_url'`
        )
      } else {
        await setSetting(
          client,
          "scan_webhook_url",
          patch.scan_webhook_url.trim()
        )
      }
    }
    await writeAudit(client, {
      action: "settings.update",
      details: patch as Record<string, unknown>,
    })
  })
}

export function getStorageStatus() {
  return {
    configured: isStorageConfigured(),
    bucketNaming: "pg-<projectUuidWithoutDashes>",
    samplePhysicalBucket: physicalBucketName(
      "00000000-0000-0000-0000-000000000000"
    ),
    scanWebhookConfigured: Boolean(
      process.env.STORAGE_SCAN_WEBHOOK_URL?.trim()
    ),
    publicUrlConfigured: Boolean(
      process.env.RUSTFS_PUBLIC_URL?.trim() ||
        process.env.S3_PUBLIC_URL?.trim()
    ),
  }
}
