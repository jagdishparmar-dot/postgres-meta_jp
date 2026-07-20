import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getObjectUploadUrl } from "@/lib/storage/service"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; bucketId: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, bucketId } = await context.params
    const body = (await request.json()) as {
      path?: string
      contentType?: string
      expiresIn?: number
    }
    if (!body.path?.trim()) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }
    const result = await getObjectUploadUrl(id, {
      bucketId,
      path: body.path,
      contentType: body.contentType,
      expiresIn: body.expiresIn,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create upload URL",
      },
      { status: 400 }
    )
  }
}
