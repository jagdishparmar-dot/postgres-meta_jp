import { NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getStorageStatus } from "@/lib/storage/service"

export const runtime = "nodejs"

export async function GET() {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  return NextResponse.json(getStorageStatus())
}
