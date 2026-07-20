import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { createBucket, listBuckets } from "@/lib/storage/service"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const buckets = await listBuckets(id)
    return NextResponse.json({ buckets })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list buckets",
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
    const body = (await request.json()) as { name?: string; public?: boolean }
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Bucket name is required" },
        { status: 400 }
      )
    }
    const bucket = await createBucket(id, {
      name: body.name,
      public: body.public,
    })
    return NextResponse.json({ bucket })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create bucket",
      },
      { status: 400 }
    )
  }
}
