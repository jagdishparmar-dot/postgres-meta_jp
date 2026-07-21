import { NextRequest, NextResponse } from "next/server"
import { cookieSecure, isAdminAuthRequired } from "@/lib/env"

export const ADMIN_SESSION_COOKIE = "pgadmin_admin_session"
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

export function isAdminAuthEnabled(): boolean {
  return isAdminAuthRequired()
}

function sessionSecret(): string {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim()
  if (fromEnv) return fromEnv
  const id = process.env.ADMIN_ID?.trim() ?? ""
  const password = process.env.ADMIN_PASSWORD?.trim() ?? ""
  return `${password}:pgadmin-admin:${id}`
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  return base64url(signature)
}

export function verifyAdminCredentials(
  username: string,
  password: string
): boolean {
  if (!isAdminAuthEnabled()) return false
  const expectedId = process.env.ADMIN_ID?.trim()
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim()
  if (!expectedId || !expectedPassword) return false
  return safeEqual(username, expectedId) && safeEqual(password, expectedPassword)
}

export async function createAdminSessionToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC
  const sig = await hmacSha256Base64Url(sessionSecret(), String(exp))
  return `${exp}.${sig}`
}

export async function isValidAdminSessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token || !isAdminAuthEnabled()) return false
  const [expRaw, sig] = token.split(".")
  if (!expRaw || !sig) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false
  const expected = await hmacSha256Base64Url(sessionSecret(), expRaw)
  return safeEqual(sig, expected)
}

export async function isAdminAuthenticated(
  request: NextRequest
): Promise<boolean> {
  if (!isAdminAuthEnabled()) return true
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  return isValidAdminSessionToken(token)
}

export function isPublicAdminPath(pathname: string): boolean {
  if (pathname === "/login") return true
  if (pathname === "/api/health") return true
  if (pathname === "/api/ready") return true
  if (pathname.startsWith("/api/auth/login")) return true
  if (pathname.startsWith("/api/auth/logout")) return true
  if (/^\/api\/platform\/projects\/[^/]+\/storage\/public\//.test(pathname)) {
    return true
  }
  return false
}

export async function requireAdminApiAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  if (await isAdminAuthenticated(request)) return null
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export async function setAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(),
    maxAge: SESSION_MAX_AGE_SEC,
  })
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(),
    maxAge: 0,
  })
}
