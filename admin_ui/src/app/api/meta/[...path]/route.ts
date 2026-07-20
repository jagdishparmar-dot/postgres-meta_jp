import { NextRequest, NextResponse } from "next/server"
import { metaFetch, MetaApiError } from "@/lib/meta"
import { resolveConnectionString } from "@/lib/connection-session"

const ALLOWED_PREFIXES = [
  "schemas",
  "tables",
  "views",
  "materialized-views",
  "foreign-tables",
  "functions",
  "roles",
  "extensions",
  "indexes",
  "triggers",
  "types",
  "policies",
  "publications",
  "columns",
  "table-privileges",
  "config",
  "generators",
]

type RouteContext = {
  params: Promise<{ path: string[] }>
}

export const runtime = "nodejs"

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const connectionString = await resolveConnectionString(request)
    if (!connectionString) {
      return NextResponse.json(
        { error: "Missing database connection. Connect first." },
        { status: 401 }
      )
    }

    const { path } = await context.params
    if (!path?.length || !ALLOWED_PREFIXES.includes(path[0])) {
      return NextResponse.json({ error: "Unsupported meta path." }, { status: 404 })
    }

    const search = request.nextUrl.search
    const metaPath = `/${path.join("/")}${search}`

    let body: string | undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text()
      body = text || undefined
    }

    const data = await metaFetch<unknown>(metaPath, connectionString, {
      method: request.method,
      body,
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof MetaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message =
      error instanceof Error ? error.message : "Failed to reach postgres-meta"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}
