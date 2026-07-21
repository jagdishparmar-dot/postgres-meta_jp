import { createClient, type RedisClientType } from "redis"
import { getProjectRedisUrl } from "@/lib/redis/link"

export type RedisKeyType =
  | "string"
  | "list"
  | "set"
  | "zset"
  | "hash"
  | "stream"
  | "none"
  | string

export type RedisKeyEntry = {
  key: string
  type: RedisKeyType
  ttl: number
}

export type RedisInfoSummary = {
  redis_version: string | null
  used_memory_human: string | null
  connected_clients: string | null
  keyspace: string | null
  uptime_in_seconds: string | null
}

async function withClient<T>(
  projectId: string,
  fn: (client: RedisClientType) => Promise<T>
): Promise<T> {
  const url = await getProjectRedisUrl(projectId)
  if (!url) throw new Error("Redis is not linked to this project")

  const client = createClient({
    url,
    socket: {
      connectTimeout: 8_000,
      reconnectStrategy: false,
    },
  }) as RedisClientType

  try {
    await client.connect()
    return await fn(client)
  } finally {
    try {
      await client.quit()
    } catch {
      try {
        client.destroy()
      } catch {
        // ignore
      }
    }
  }
}

export async function pingRedis(url: string): Promise<{ ok: true; pong: string }> {
  const client = createClient({
    url,
    socket: { connectTimeout: 8_000, reconnectStrategy: false },
  }) as RedisClientType
  try {
    await client.connect()
    const pong = await client.ping()
    return { ok: true, pong }
  } finally {
    try {
      await client.quit()
    } catch {
      try {
        client.destroy()
      } catch {
        // ignore
      }
    }
  }
}

export async function testProjectRedis(projectId: string) {
  const url = await getProjectRedisUrl(projectId)
  if (!url) throw new Error("Redis is not linked to this project")
  return pingRedis(url)
}

export async function getRedisInfo(
  projectId: string
): Promise<RedisInfoSummary> {
  return withClient(projectId, async (client) => {
    const raw = await client.info()
    const map = new Map<string, string>()
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue
      const i = line.indexOf(":")
      if (i <= 0) continue
      map.set(line.slice(0, i), line.slice(i + 1))
    }
    const dbs = [...map.entries()]
      .filter(([k]) => /^db\d+$/.test(k))
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    return {
      redis_version: map.get("redis_version") ?? null,
      used_memory_human: map.get("used_memory_human") ?? null,
      connected_clients: map.get("connected_clients") ?? null,
      keyspace: dbs || null,
      uptime_in_seconds: map.get("uptime_in_seconds") ?? null,
    }
  })
}

export async function scanRedisKeys(
  projectId: string,
  opts: { match?: string; cursor?: string; count?: number } = {}
): Promise<{ cursor: string; keys: RedisKeyEntry[] }> {
  const match = opts.match?.trim() || "*"
  const count = Math.min(Math.max(opts.count ?? 50, 1), 200)
  const cursor = opts.cursor || "0"

  return withClient(projectId, async (client) => {
    const result = await client.scan(cursor, {
      MATCH: match,
      COUNT: count,
    })
    const keys: RedisKeyEntry[] = []
    for (const key of result.keys) {
      const [type, ttl] = await Promise.all([
        client.type(key),
        client.ttl(key),
      ])
      keys.push({ key, type, ttl })
    }
    keys.sort((a, b) => a.key.localeCompare(b.key))
    return { cursor: result.cursor, keys }
  })
}

export async function getRedisValue(
  projectId: string,
  key: string
): Promise<{
  key: string
  type: RedisKeyType
  ttl: number
  value: unknown
}> {
  if (!key) throw new Error("Key is required")
  return withClient(projectId, async (client) => {
    const type = await client.type(key)
    const ttl = await client.ttl(key)
    let value: unknown = null

    switch (type) {
      case "string":
        value = await client.get(key)
        break
      case "list":
        value = await client.lRange(key, 0, 199)
        break
      case "set": {
        const members = await client.sMembers(key)
        value = members.slice(0, 200)
        break
      }
      case "zset":
        value = await client.zRangeWithScores(key, 0, 199)
        break
      case "hash":
        value = await client.hGetAll(key)
        break
      case "stream":
        value = await client.xRange(key, "-", "+", { COUNT: 50 })
        break
      case "none":
        value = null
        break
      default:
        value = `(unsupported type: ${type})`
    }

    return { key, type, ttl, value }
  })
}

export async function setRedisString(
  projectId: string,
  opts: { key: string; value: string; ttlSeconds?: number | null }
): Promise<void> {
  const key = opts.key.trim()
  if (!key) throw new Error("Key is required")
  return withClient(projectId, async (client) => {
    if (opts.ttlSeconds != null && opts.ttlSeconds > 0) {
      await client.set(key, opts.value, { EX: opts.ttlSeconds })
    } else {
      await client.set(key, opts.value)
    }
  })
}

export async function deleteRedisKey(
  projectId: string,
  key: string
): Promise<number> {
  if (!key) throw new Error("Key is required")
  return withClient(projectId, async (client) => client.del(key))
}

export async function setRedisTtl(
  projectId: string,
  key: string,
  ttlSeconds: number | null
): Promise<void> {
  if (!key) throw new Error("Key is required")
  return withClient(projectId, async (client) => {
    if (ttlSeconds == null || ttlSeconds < 0) {
      await client.persist(key)
    } else {
      await client.expire(key, ttlSeconds)
    }
  })
}
