import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** @deprecated Use GET /api/platform/databases */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Use GET /api/platform/databases. Projects now link to databases on PG_MASTER_URL.",
    },
    { status: 410 }
  )
}
