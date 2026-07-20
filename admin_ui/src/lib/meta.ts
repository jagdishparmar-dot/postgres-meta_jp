const PG_META_URL = process.env.PG_META_URL || "http://localhost:1337"

export class MetaApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function metaFetch<T>(
  path: string,
  connectionString: string,
  init?: RequestInit
): Promise<T> {
  const url = `${PG_META_URL}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      pg: connectionString,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: text || "Unexpected response from postgres-meta" }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `postgres-meta request failed (${response.status})`
    throw new MetaApiError(message, response.status)
  }

  return body as T
}
