import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { requireAdminApiAuth } from "@/lib/admin-auth"

function probeAuthorized(request: NextRequest): boolean {
  const token = process.env.READY_PROBE_TOKEN?.trim()
  if (!token) return false
  const auth = request.headers.get("authorization")
  if (auth === `Bearer ${token}`) return true
  return request.nextUrl.searchParams.get("token") === token
}

/** Readiness probe — platform DB reachable. Use READY_PROBE_TOKEN for load balancers. */
export async function GET(request: NextRequest) {
  if (!probeAuthorized(request)) {
    const denied = await requireAdminApiAuth(request)
    if (denied) return denied
  }

  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { ok: false, ready: false, error: "Platform is not configured." },
      { status: 503 }
    )
  }

  try {
    const { getPlatformPool } = await import("@/lib/platform/db")
    const pool = getPlatformPool()
    await pool.query("SELECT 1")
    return NextResponse.json({ ok: true, ready: true })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        error: err instanceof Error ? err.message : "Platform DB unreachable",
      },
      { status: 503 }
    )
  }
}
