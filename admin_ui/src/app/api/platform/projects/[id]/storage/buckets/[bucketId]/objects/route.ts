import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { browseObjects, uploadObject } from "@/lib/storage/service"

export const runtime = "nodejs"

// Large uploads (multipart handled server-side after body received)
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string; bucketId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, bucketId } = await context.params
    const prefix = request.nextUrl.searchParams.get("prefix") || undefined
    const browse = await browseObjects(id, bucketId, { prefix })
    return NextResponse.json(browse)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to browse objects",
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
    const { id, bucketId } = await context.params
    const form = await request.formData()
    const file = form.get("file")
    const pathRaw = form.get("path")
    const contentTypeRaw = form.get("contentType")
    const prefixRaw = form.get("prefix")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const prefix =
      typeof prefixRaw === "string" && prefixRaw
        ? prefixRaw.replace(/^\/+/, "").replace(/\/?$/, "/")
        : ""
    const fileName =
      (typeof pathRaw === "string" && pathRaw.trim()) || file.name || "upload.bin"
    const path = fileName.includes("/")
      ? fileName.replace(/^\/+/, "")
      : `${prefix}${fileName}`

    const contentType =
      (typeof contentTypeRaw === "string" && contentTypeRaw) ||
      file.type ||
      "application/octet-stream"

    const buffer = Buffer.from(await file.arrayBuffer())
    const object = await uploadObject(id, {
      bucketId,
      path,
      body: buffer,
      contentType,
    })
    return NextResponse.json({ object })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload object",
      },
      { status: 400 }
    )
  }
}
