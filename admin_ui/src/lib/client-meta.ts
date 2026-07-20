import type { DbConnectionConfig } from "@/lib/connection"

async function metaRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`/api/meta/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Request failed (${res.status})`
    )
  }
  return data as T
}

/** Connection arg kept for call-site compatibility; auth uses httpOnly vault cookie. */
export async function fetchMeta<T>(
  path: string,
  _connection?: DbConnectionConfig | null
): Promise<T> {
  return metaRequest<T>(path, { method: "GET" })
}

export async function postMeta<T>(
  path: string,
  body: unknown,
  _connection?: DbConnectionConfig | null
): Promise<T> {
  return metaRequest<T>(path, { method: "POST", body: JSON.stringify(body) })
}

export async function patchMeta<T>(
  path: string,
  body: unknown,
  _connection?: DbConnectionConfig | null
): Promise<T> {
  return metaRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) })
}

export async function deleteMeta<T>(
  path: string,
  _connection?: DbConnectionConfig | null,
  body?: unknown
): Promise<T> {
  return metaRequest<T>(path, {
    method: "DELETE",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
