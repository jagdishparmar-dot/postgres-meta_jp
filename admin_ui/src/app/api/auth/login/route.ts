import { NextRequest, NextResponse } from "next/server"
import {
  isAdminAuthEnabled,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth"
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  getClientIp,
  recordLoginFailure,
} from "@/lib/login-rate-limit"

export async function POST(request: NextRequest) {
  if (!isAdminAuthEnabled()) {
    return NextResponse.json(
      { error: "Admin login is not configured." },
      { status: 503 }
    )
  }

  const ip = getClientIp(request)
  const limit = checkLoginRateLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again in ${limit.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: limit.retryAfterSec
          ? { "Retry-After": String(limit.retryAfterSec) }
          : undefined,
      }
    )
  }

  let body: { username?: string; password?: string }
  try {
    body = (await request.json()) as { username?: string; password?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const username = body.username?.trim() ?? ""
  const password = body.password ?? ""

  if (!username || !password) {
    return NextResponse.json(
      { error: "Admin ID and password are required." },
      { status: 400 }
    )
  }

  if (!verifyAdminCredentials(username, password)) {
    recordLoginFailure(ip)
    return NextResponse.json(
      { error: "Invalid admin ID or password." },
      { status: 401 }
    )
  }

  clearLoginAttempts(ip)
  const response = NextResponse.json({ ok: true })
  await setAdminSessionCookie(response)
  return response
}
