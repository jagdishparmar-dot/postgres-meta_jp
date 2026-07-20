import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { listAuditLog } from "@/lib/storage/ops"

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
    const limit = Number(request.nextUrl.searchParams.get("limit") || 100)
    const action = request.nextUrl.searchParams.get("action") || undefined
    const entries = await listAuditLog(id, { limit, action })
    return NextResponse.json({ entries })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load audit log",
      },
      { status: 400 }
    )
  }
}
