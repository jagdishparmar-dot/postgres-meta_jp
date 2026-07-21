const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

type Bucket = {
  failures: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

function prune(now: number) {
  if (buckets.size < 500) return
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key)
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function checkLoginRateLimit(ip: string): {
  allowed: boolean
  retryAfterSec?: number
} {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(ip)
  if (!bucket) return { allowed: true }

  if (now - bucket.windowStart > WINDOW_MS) {
    buckets.delete(ip)
    return { allowed: true }
  }

  if (bucket.failures < MAX_ATTEMPTS) return { allowed: true }

  const retryAfterSec = Math.ceil(
    (WINDOW_MS - (now - bucket.windowStart)) / 1000
  )
  return { allowed: false, retryAfterSec }
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const bucket = buckets.get(ip)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(ip, { failures: 1, windowStart: now })
    return
  }
  bucket.failures += 1
}

export function clearLoginAttempts(ip: string): void {
  buckets.delete(ip)
}
