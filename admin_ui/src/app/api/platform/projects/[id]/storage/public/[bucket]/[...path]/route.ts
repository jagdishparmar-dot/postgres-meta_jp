import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { ensureStorageReady, withProjectClient } from "@/lib/storage/db"
import { getObjectBytes } from "@/lib/storage/s3"

export const runtime = "nodejs"

type Ctx = {
  params: Promise<{ id: string; bucket: string; path: string[] }>
}

/**
 * Public object proxy for public buckets.
 * Works even when RUSTFS_PUBLIC_URL is unset (streams via admin API).
 */
export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, bucket, path } = await context.params
    const objectPath = path.map(decodeURIComponent).join("/")
    if (!objectPath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 })
    }

    await ensureStorageReady(id)
    const meta = await withProjectClient(id, async (client) => {
      const res = await client.query<{
        public: boolean
        status: string
        mime_type: string | null
      }>(
        `SELECT b.public, COALESCE(o.status, 'ready') AS status, o.mime_type
         FROM storage.buckets b
         JOIN storage.objects o ON o.bucket_id = b.id
         WHERE b.name = $1 AND o.name = $2`,
        [bucket, objectPath]
      )
      return res.rows[0] || null
    })

    if (!meta) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (!meta.public) {
      return NextResponse.json(
        { error: "Bucket is not public" },
        { status: 403 }
      )
    }
    if (meta.status !== "ready") {
      return NextResponse.json(
        { error: `Object unavailable (${meta.status})` },
        { status: 403 }
      )
    }

    const obj = await getObjectBytes({
      projectId: id,
      logicalBucket: bucket,
      objectPath,
    })

    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type":
          obj.contentType || meta.mime_type || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch object",
      },
      { status: 400 }
    )
  }
}
