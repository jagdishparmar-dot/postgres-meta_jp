import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { deleteBucket, updateBucket } from "@/lib/storage/service"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; bucketId: string }> }

export async function PATCH(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, bucketId } = await context.params
    const body = (await request.json()) as {
      public?: boolean
      file_size_limit?: number | null
      allowed_mime_types?: string[] | null
    }
    const bucket = await updateBucket(id, bucketId, body)
    return NextResponse.json({ bucket })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update bucket",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, bucketId } = await context.params
    await deleteBucket(id, bucketId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete bucket",
      },
      { status: 400 }
    )
  }
}
