import { NextRequest, NextResponse } from "next/server"
import { metaFetch, MetaApiError } from "@/lib/meta"
import { resolveConnectionString } from "@/lib/connection-session"

type Body = {
  query?: string
  action?: "run" | "format"
  parameters?: unknown[]
}

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const connectionString = await resolveConnectionString(request)
    if (!connectionString) {
      return NextResponse.json(
        { error: "Missing database connection. Connect first." },
        { status: 401 }
      )
    }

    const body = (await request.json()) as Body
    const query = body.query?.trim()
    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 })
    }

    const action = body.action || "run"

    if (action === "format") {
      const formatted = await metaFetch<string>(
        "/query/format",
        connectionString,
        {
          method: "POST",
          body: JSON.stringify({ query }),
        }
      )
      return NextResponse.json({ formatted })
    }

    const started = Date.now()
    const rows = await metaFetch<Record<string, unknown>[]>(
      "/query",
      connectionString,
      {
        method: "POST",
        body: JSON.stringify({
          query,
          parameters: body.parameters,
        }),
      }
    )
    const durationMs = Date.now() - started
    const columns =
      Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []

    return NextResponse.json({
      rows: Array.isArray(rows) ? rows : [],
      columns,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      durationMs,
    })
  } catch (error) {
    if (error instanceof MetaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message =
      error instanceof Error ? error.message : "Failed to execute query"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
