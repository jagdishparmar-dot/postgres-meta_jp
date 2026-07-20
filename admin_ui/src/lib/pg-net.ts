import { Client } from "pg"

export type PgNetStatus = {
  installed: boolean
  available: boolean
  error?: string
}

export type PgNetResponse = {
  id: number
  status_code: number | null
  content_type: string | null
  headers: unknown
  content: string | null
  timed_out: boolean | null
  error_msg: string | null
  created: string | null
}

export type PgNetQueueItem = {
  id: number
  method: string | null
  url: string | null
  headers: unknown
  body: string | null
  timeout_milliseconds: number | null
}

async function withClient<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function getPgNetStatus(
  connectionString: string
): Promise<PgNetStatus> {
  return withClient(connectionString, async (client) => {
    const installed = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
       ) AS exists`
    )
    const available = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net'
       ) AS exists`
    )
    return {
      installed: Boolean(installed.rows[0]?.exists),
      available: Boolean(available.rows[0]?.exists),
    }
  })
}

export async function enablePgNet(
  connectionString: string
): Promise<PgNetStatus> {
  return withClient(connectionString, async (client) => {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_net`)
    } catch (err) {
      const status = await getPgNetStatus(connectionString)
      return {
        ...status,
        error:
          err instanceof Error
            ? err.message
            : "Failed to enable pg_net. Ensure the extension is packaged on this Postgres instance.",
      }
    }
    return getPgNetStatus(connectionString)
  })
}

export async function listPgNetResponses(
  connectionString: string,
  limit = 50
): Promise<PgNetResponse[]> {
  const lim = Math.min(Math.max(limit, 1), 200)
  return withClient(connectionString, async (client) => {
    // Table name differs slightly across versions; try common ones
    const tables = await client.query<{ relname: string }>(
      `SELECT relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'net'
         AND c.relkind = 'r'
         AND c.relname IN ('_http_response', 'http_response')
       ORDER BY c.relname`
    )
    const table = tables.rows[0]?.relname
    if (!table) return []

    const res = await client.query(
      `SELECT id, status_code, content_type, headers, content,
              timed_out, error_msg, created
       FROM net.${table === "http_response" ? "http_response" : "_http_response"}
       ORDER BY id DESC
       LIMIT $1`,
      [lim]
    )
    return res.rows.map((r) => ({
      id: Number(r.id),
      status_code: r.status_code == null ? null : Number(r.status_code),
      content_type: r.content_type,
      headers: r.headers,
      content:
        r.content == null
          ? null
          : typeof r.content === "string"
            ? r.content
            : String(r.content),
      timed_out: r.timed_out == null ? null : Boolean(r.timed_out),
      error_msg: r.error_msg,
      created: r.created ? new Date(r.created).toISOString() : null,
    }))
  })
}

export async function listPgNetQueue(
  connectionString: string,
  limit = 50
): Promise<PgNetQueueItem[]> {
  const lim = Math.min(Math.max(limit, 1), 200)
  return withClient(connectionString, async (client) => {
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'net' AND table_name = 'http_request_queue'
       ) AS exists`
    )
    if (!exists.rows[0]?.exists) return []

    const res = await client.query(
      `SELECT id, method, url, headers, body, timeout_milliseconds
       FROM net.http_request_queue
       ORDER BY id DESC
       LIMIT $1`,
      [lim]
    )
    return res.rows.map((r) => ({
      id: Number(r.id),
      method: r.method,
      url: r.url,
      headers: r.headers,
      body:
        r.body == null
          ? null
          : typeof r.body === "string"
            ? r.body
            : String(r.body),
      timeout_milliseconds:
        r.timeout_milliseconds == null
          ? null
          : Number(r.timeout_milliseconds),
    }))
  })
}

export async function sendPgNetRequest(
  connectionString: string,
  input: {
    method: "GET" | "POST" | "DELETE"
    url: string
    headers?: Record<string, string>
    body?: string | Record<string, unknown> | null
    params?: Record<string, string>
    timeout_ms?: number
  }
): Promise<{ request_id: number }> {
  const url = input.url.trim()
  if (!url) throw new Error("URL is required")
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL must start with http:// or https://")
  }

  const headers = input.headers || {}
  const timeout = Math.min(Math.max(input.timeout_ms ?? 5000, 100), 60000)
  const params = input.params || {}

  return withClient(connectionString, async (client) => {
    if (input.method === "GET") {
      const res = await client.query<{ id: number }>(
        `SELECT net.http_get(
           url := $1,
           headers := $2::jsonb,
           params := $3::jsonb,
           timeout_milliseconds := $4
         ) AS id`,
        [url, JSON.stringify(headers), JSON.stringify(params), timeout]
      )
      return { request_id: Number(res.rows[0].id) }
    }

    if (input.method === "DELETE") {
      // Older pg_net may not have http_delete; fall back to http_get with method via post body not available —
      // try http_delete, else error with helpful message
      try {
        const res = await client.query<{ id: number }>(
          `SELECT net.http_delete(
             url := $1,
             headers := $2::jsonb,
             params := $3::jsonb,
             timeout_milliseconds := $4
           ) AS id`,
          [url, JSON.stringify(headers), JSON.stringify(params), timeout]
        )
        return { request_id: Number(res.rows[0].id) }
      } catch {
        throw new Error(
          "net.http_delete is not available on this pg_net version. Use GET or POST."
        )
      }
    }

    // POST
    let bodyJson: string
    if (input.body == null || input.body === "") {
      bodyJson = "{}"
    } else if (typeof input.body === "string") {
      try {
        JSON.parse(input.body)
        bodyJson = input.body
      } catch {
        bodyJson = JSON.stringify({ raw: input.body })
      }
    } else {
      bodyJson = JSON.stringify(input.body)
    }

    const res = await client.query<{ id: number }>(
      `SELECT net.http_post(
         url := $1,
         body := $2::jsonb,
         headers := $3::jsonb,
         params := $4::jsonb,
         timeout_milliseconds := $5
       ) AS id`,
      [
        url,
        bodyJson,
        JSON.stringify({
          "Content-Type": "application/json",
          ...headers,
        }),
        JSON.stringify(params),
        timeout,
      ]
    )
    return { request_id: Number(res.rows[0].id) }
  })
}

export async function collectPgNetResponses(
  connectionString: string
): Promise<number> {
  return withClient(connectionString, async (client) => {
    // Newer pg_net exposes net._await_response / worker collects automatically.
    // Try optional collect helpers if present.
    try {
      const res = await client.query<{ n: number }>(
        `SELECT net.worker_restart() AS n`
      )
      return Number(res.rows[0]?.n ?? 0)
    } catch {
      return 0
    }
  })
}

export async function clearPgNetResponses(
  connectionString: string,
  olderThanHours = 24
): Promise<number> {
  return withClient(connectionString, async (client) => {
    const tables = await client.query<{ relname: string }>(
      `SELECT relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'net'
         AND c.relkind = 'r'
         AND c.relname IN ('_http_response', 'http_response')`
    )
    const table = tables.rows[0]?.relname
    if (!table) return 0
    const ident = table === "http_response" ? "http_response" : "_http_response"
    const res = await client.query(
      `DELETE FROM net.${ident}
       WHERE created < now() - ($1::text || ' hours')::interval`,
      [String(olderThanHours)]
    )
    return res.rowCount ?? 0
  })
}
