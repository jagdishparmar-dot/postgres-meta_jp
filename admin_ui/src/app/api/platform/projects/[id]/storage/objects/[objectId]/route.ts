import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { copyObject, deleteObject, moveObject } from "@/lib/storage/service"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; objectId: string }> }

export async function PATCH(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, objectId } = await context.params
    const body = (await request.json()) as {
      action?: "move" | "rename" | "copy"
      toPath?: string
    }
    if (!body.toPath?.trim()) {
      return NextResponse.json(
        { error: "toPath is required" },
        { status: 400 }
      )
    }
    const action = body.action || "move"
    const object =
      action === "copy"
        ? await copyObject(id, { objectId, toPath: body.toPath })
        : await moveObject(id, { objectId, toPath: body.toPath })
    return NextResponse.json({ object })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update object",
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
    const { id, objectId } = await context.params
    await deleteObject(id, objectId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete object",
      },
      { status: 400 }
    )
  }
}
