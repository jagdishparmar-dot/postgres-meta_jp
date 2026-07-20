import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { importZip } from "@/lib/storage/ops"

export const runtime = "nodejs"
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const form = await request.formData()
    const file = form.get("file")
    const bucketId = form.get("bucketId")
    const prefix = form.get("prefix")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }
    if (typeof bucketId !== "string" || !bucketId) {
      return NextResponse.json(
        { error: "bucketId is required" },
        { status: 400 }
      )
    }

    const zip = Buffer.from(await file.arrayBuffer())
    const result = await importZip(id, {
      bucketId,
      prefix: typeof prefix === "string" ? prefix : undefined,
      zip,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to import zip",
      },
      { status: 400 }
    )
  }
}
