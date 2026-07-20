import { NextRequest, NextResponse } from "next/server"
import {
  deleteConnection,
  getSavedConnection,
  listSavedConnections,
  upsertConnection,
} from "@/lib/connection-vault"
import {
  clearActiveConnectionCookie,
  getActiveConnectionId,
  setActiveConnectionCookie,
} from "@/lib/connection-session"
import type { DbConnectionConfig, SslMode } from "@/lib/connection"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const activeId = getActiveConnectionId(request)
  return NextResponse.json({
    connections: listSavedConnections(),
    activeId: activeId || null,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DbConnectionConfig & {
      activate?: boolean
    }

    if (!body?.host || !body?.database || !body?.user) {
      return NextResponse.json(
        { error: "Host, database, and user are required." },
        { status: 400 }
      )
    }

    const saved = upsertConnection({
      id: body.id,
      name: body.name || "Postgres",
      host: body.host,
      port: body.port || "5432",
      database: body.database,
      user: body.user,
      sslMode: (body.sslMode || "disable") as SslMode,
      password: body.id && !body.password ? undefined : body.password ?? "",
    })

    const response = NextResponse.json({ connection: saved })
    if (body.activate !== false) {
      setActiveConnectionCookie(response, saved.id)
    }
    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save connection"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing connection id." }, { status: 400 })
  }

  const existed = getSavedConnection(id)
  if (!existed) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 })
  }

  deleteConnection(id)
  const response = NextResponse.json({ ok: true })
  if (getActiveConnectionId(request) === id) {
    clearActiveConnectionCookie(response)
  }
  return response
}
