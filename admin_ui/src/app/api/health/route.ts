import { NextResponse } from "next/server"

/** Liveness probe for load balancers — no auth, no DB. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "admin_ui",
    timestamp: new Date().toISOString(),
  })
}
