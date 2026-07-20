import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getObjectDownloadUrl } from "@/lib/storage/service"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; objectId: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id, objectId } = await context.params
    const expiresParam = request.nextUrl.searchParams.get("expiresIn")
    const expiresIn = expiresParam ? Number(expiresParam) : undefined
    const result = await getObjectDownloadUrl(id, objectId, {
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create download URL",
      },
      { status: 400 }
    )
  }
}
