import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { createFolder } from "@/lib/storage/service"

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
    const body = (await request.json()) as { name?: string; prefix?: string }
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      )
    }
    const result = await createFolder(id, {
      bucketId,
      name: body.name,
      prefix: body.prefix,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create folder",
      },
      { status: 400 }
    )
  }
}
