import {
  CopyObjectCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export type RustFsConfig = {
  endpoint: string
  accessKey: string
  secretKey: string
  region: string
  publicUrl: string | null
  forcePathStyle: boolean
}

export function getRustFsConfig(): RustFsConfig | null {
  const endpoint =
    process.env.RUSTFS_ENDPOINT?.trim() ||
    process.env.S3_ENDPOINT?.trim() ||
    null
  const accessKey =
    process.env.RUSTFS_ACCESS_KEY?.trim() ||
    process.env.S3_ACCESS_KEY?.trim() ||
    null
  const secretKey =
    process.env.RUSTFS_SECRET_KEY?.trim() ||
    process.env.S3_SECRET_KEY?.trim() ||
    null

  if (!endpoint || !accessKey || !secretKey) return null

  return {
    endpoint: endpoint.replace(/\/$/, ""),
    accessKey,
    secretKey,
    region:
      process.env.RUSTFS_REGION?.trim() ||
      process.env.S3_REGION?.trim() ||
      "us-east-1",
    publicUrl:
      process.env.RUSTFS_PUBLIC_URL?.trim()?.replace(/\/$/, "") ||
      process.env.S3_PUBLIC_URL?.trim()?.replace(/\/$/, "") ||
      null,
    forcePathStyle:
      (process.env.RUSTFS_FORCE_PATH_STYLE ||
        process.env.S3_FORCE_PATH_STYLE ||
        "true") !== "false",
  }
}

export function isStorageConfigured(): boolean {
  return Boolean(getRustFsConfig())
}

let cachedClient: S3Client | null = null

export function getS3Client(): S3Client {
  const cfg = getRustFsConfig()
  if (!cfg) {
    throw new Error(
      "RustFS/S3 is not configured. Set RUSTFS_ENDPOINT, RUSTFS_ACCESS_KEY, and RUSTFS_SECRET_KEY."
    )
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
    })
  }
  return cachedClient
}

/** Physical RustFS bucket for a project (one bucket per project). */
export function physicalBucketName(projectId: string): string {
  const id = projectId.replace(/-/g, "").toLowerCase()
  return `pg-${id}`.slice(0, 63)
}

export function objectKey(logicalBucket: string, objectPath: string): string {
  const clean = objectPath.replace(/^\/+/, "")
  return `${logicalBucket}/${clean}`
}

export async function ensurePhysicalBucket(projectId: string): Promise<string> {
  const name = physicalBucketName(projectId)
  const client = getS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: name }))
  }
  return name
}

const MULTIPART_THRESHOLD = 8 * 1024 * 1024 // 8 MB
const PART_SIZE = 8 * 1024 * 1024

export async function putObjectBytes(opts: {
  projectId: string
  logicalBucket: string
  objectPath: string
  body: Buffer | Uint8Array
  contentType?: string
}): Promise<{ etag?: string; key: string; physicalBucket: string }> {
  const physicalBucket = await ensurePhysicalBucket(opts.projectId)
  const key = objectKey(opts.logicalBucket, opts.objectPath)
  const client = getS3Client()
  const body = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body)
  const contentType = opts.contentType || "application/octet-stream"

  if (body.length < MULTIPART_THRESHOLD) {
    const res = await client.send(
      new PutObjectCommand({
        Bucket: physicalBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
    return {
      etag: res.ETag?.replace(/"/g, ""),
      key,
      physicalBucket,
    }
  }

  // Multipart for large objects
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: physicalBucket,
      Key: key,
      ContentType: contentType,
    })
  )
  const uploadId = created.UploadId
  if (!uploadId) throw new Error("Failed to start multipart upload")

  try {
    const parts: { ETag: string; PartNumber: number }[] = []
    let partNumber = 1
    for (let offset = 0; offset < body.length; offset += PART_SIZE) {
      const chunk = body.subarray(offset, offset + PART_SIZE)
      const part = await client.send(
        new UploadPartCommand({
          Bucket: physicalBucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: chunk,
        })
      )
      if (!part.ETag) throw new Error(`Missing ETag for part ${partNumber}`)
      parts.push({ ETag: part.ETag, PartNumber: partNumber })
      partNumber += 1
    }
    const completed = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: physicalBucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    )
    return {
      etag: completed.ETag?.replace(/"/g, ""),
      key,
      physicalBucket,
    }
  } catch (err) {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: physicalBucket,
          Key: key,
          UploadId: uploadId,
        })
      )
    } catch {
      // ignore abort errors
    }
    throw err
  }
}

export async function copyObjectBytes(opts: {
  projectId: string
  logicalBucket: string
  fromPath: string
  toPath: string
}): Promise<{ key: string; physicalBucket: string }> {
  const physicalBucket = await ensurePhysicalBucket(opts.projectId)
  const fromKey = objectKey(opts.logicalBucket, opts.fromPath)
  const toKey = objectKey(opts.logicalBucket, opts.toPath)
  const client = getS3Client()
  await client.send(
    new CopyObjectCommand({
      Bucket: physicalBucket,
      // Path-style sources: encode each segment for special characters
      CopySource: encodeURIComponent(`${physicalBucket}/${fromKey}`).replace(
        /%2F/g,
        "/"
      ),
      Key: toKey,
    })
  )
  return { key: toKey, physicalBucket }
}

export async function deleteObjectBytes(opts: {
  projectId: string
  logicalBucket: string
  objectPath: string
}): Promise<void> {
  const physicalBucket = physicalBucketName(opts.projectId)
  const key = objectKey(opts.logicalBucket, opts.objectPath)
  const client = getS3Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: physicalBucket,
      Key: key,
    })
  )
}

export async function getObjectBytes(opts: {
  projectId: string
  logicalBucket: string
  objectPath: string
}): Promise<{ body: Buffer; contentType?: string }> {
  const physicalBucket = physicalBucketName(opts.projectId)
  const key = objectKey(opts.logicalBucket, opts.objectPath)
  const client = getS3Client()
  const res = await client.send(
    new GetObjectCommand({
      Bucket: physicalBucket,
      Key: key,
    })
  )
  const bytes = await res.Body?.transformToByteArray()
  if (!bytes) throw new Error("Empty object body")
  return {
    body: Buffer.from(bytes),
    contentType: res.ContentType,
  }
}

export async function getPresignedDownloadUrl(opts: {
  projectId: string
  logicalBucket: string
  objectPath: string
  expiresIn?: number
}): Promise<string> {
  const physicalBucket = physicalBucketName(opts.projectId)
  const key = objectKey(opts.logicalBucket, opts.objectPath)
  const client = getS3Client()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: physicalBucket,
      Key: key,
    }),
    { expiresIn: opts.expiresIn ?? 3600 }
  )
}

export async function getPresignedUploadUrl(opts: {
  projectId: string
  logicalBucket: string
  objectPath: string
  contentType?: string
  expiresIn?: number
}): Promise<string> {
  const physicalBucket = await ensurePhysicalBucket(opts.projectId)
  const key = objectKey(opts.logicalBucket, opts.objectPath)
  const client = getS3Client()
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: physicalBucket,
      Key: key,
      ContentType: opts.contentType || "application/octet-stream",
    }),
    { expiresIn: opts.expiresIn ?? 3600 }
  )
}

export function publicObjectUrl(
  logicalBucket: string,
  objectPath: string,
  projectId: string
): string | null {
  const cfg = getRustFsConfig()
  if (!cfg?.publicUrl) return null
  const physical = physicalBucketName(projectId)
  const key = objectKey(logicalBucket, objectPath)
  return `${cfg.publicUrl}/${physical}/${key}`
}

/** List all keys under a logical bucket prefix in the physical RustFS bucket. */
export async function listPhysicalKeys(opts: {
  projectId: string
  logicalBucket: string
}): Promise<string[]> {
  const physicalBucket = physicalBucketName(opts.projectId)
  const prefix = `${opts.logicalBucket}/`
  const client = getS3Client()
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: physicalBucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    )
    for (const obj of res.Contents || []) {
      if (obj.Key) keys.push(obj.Key.slice(prefix.length))
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}
