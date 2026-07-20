import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { repairOrphans, scanOrphans } from "@/lib/storage/ops"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const bucketId =
      request.nextUrl.searchParams.get("bucketId") || undefined
    const reports = await scanOrphans(id, bucketId)
    return NextResponse.json({ reports })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to scan orphans",
      },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      bucketId?: string
      deleteDbOrphans?: boolean
      deleteS3Orphans?: boolean
    }
    if (!body.bucketId) {
      return NextResponse.json(
        { error: "bucketId is required" },
        { status: 400 }
      )
    }
    const result = await repairOrphans(id, {
      bucketId: body.bucketId,
      deleteDbOrphans: body.deleteDbOrphans,
      deleteS3Orphans: body.deleteS3Orphans,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to repair orphans",
      },
      { status: 400 }
    )
  }
}
