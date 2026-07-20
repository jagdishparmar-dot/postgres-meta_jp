import { createHmac, randomBytes, timingSafeEqual } from "crypto"

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, "base64")
}

export function generateJwtSecret(): string {
  return randomBytes(32).toString("hex")
}

export type ApiRole = "anon" | "service_role" | "authenticated"

export function signProjectJwt(opts: {
  secret: string
  role: ApiRole
  projectRef: string
  /** Expiry in seconds from now; default ~10 years */
  expiresInSecs?: number
}): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (opts.expiresInSecs ?? 60 * 60 * 24 * 365 * 10)
  const header = { alg: "HS256", typ: "JWT" }
  const payload = {
    iss: "pgadmin",
    ref: opts.projectRef,
    role: opts.role,
    iat: now,
    exp,
  }
  const h = base64UrlEncode(JSON.stringify(header))
  const p = base64UrlEncode(JSON.stringify(payload))
  const data = `${h}.${p}`
  const sig = createHmac("sha256", opts.secret)
    .update(data)
    .digest()
  return `${data}.${base64UrlEncode(sig)}`
}

export function verifyProjectJwt(
  token: string,
  secret: string
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const parts = token.split(".")
  if (parts.length !== 3) return { ok: false, error: "Invalid token" }
  const [h, p, s] = parts
  const data = `${h}.${p}`
  const expected = createHmac("sha256", secret).update(data).digest()
  let actual: Buffer
  try {
    actual = base64UrlDecode(s)
  } catch {
    return { ok: false, error: "Invalid signature encoding" }
  }
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return { ok: false, error: "Invalid signature" }
  }
  try {
    const payload = JSON.parse(base64UrlDecode(p).toString("utf8")) as Record<
      string,
      unknown
    >
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, error: "Token expired" }
    }
    return { ok: true, payload }
  } catch {
    return { ok: false, error: "Invalid payload" }
  }
}

export function mintApiKeys(opts: {
  secret: string
  projectRef: string
}): { anon_key: string; service_role_key: string } {
  return {
    anon_key: signProjectJwt({
      secret: opts.secret,
      role: "anon",
      projectRef: opts.projectRef,
    }),
    service_role_key: signProjectJwt({
      secret: opts.secret,
      role: "service_role",
      projectRef: opts.projectRef,
    }),
  }
}

export function resolveDefaultApiUrl(projectId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    ""
  if (base) {
    return `${base.replace(/\/$/, "")}/api/v1/${projectId}`
  }
  return `/api/v1/${projectId}`
}

export function parseCorsOrigins(input: string | string[] | null | undefined): string[] {
  if (Array.isArray(input)) {
    return input.map((s) => s.trim()).filter(Boolean)
  }
  if (!input?.trim()) return ["*"]
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
