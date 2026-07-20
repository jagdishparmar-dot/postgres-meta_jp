import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { deletePrefix } from "@/lib/storage/service"

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
    const body = (await request.json()) as { prefix?: string }
    if (!body.prefix?.trim()) {
      return NextResponse.json(
        { error: "prefix is required" },
        { status: 400 }
      )
    }
    const result = await deletePrefix(id, {
      bucketId,
      prefix: body.prefix,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete prefix",
      },
      { status: 400 }
    )
  }
}
