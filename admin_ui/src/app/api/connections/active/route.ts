import { NextRequest, NextResponse } from "next/server"
import { getSavedConnection } from "@/lib/connection-vault"
import {
  clearActiveConnectionCookie,
  getActiveConnectionId,
  setActiveConnectionCookie,
} from "@/lib/connection-session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const id = getActiveConnectionId(request)
  if (!id) {
    return NextResponse.json(
      { error: "No active connection." },
      { status: 401 }
    )
  }

  const connection = getSavedConnection(id)
  if (!connection) {
    const response = NextResponse.json(
      { error: "Active connection no longer exists." },
      { status: 401 }
    )
    clearActiveConnectionCookie(response)
    return response
  }

  return NextResponse.json(connection)
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearActiveConnectionCookie(response)
  return response
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string }
    if (!body?.id) {
      return NextResponse.json({ error: "Missing connection id." }, { status: 400 })
    }

    const connection = getSavedConnection(body.id)
    if (!connection) {
      return NextResponse.json({ error: "Connection not found." }, { status: 404 })
    }

    const response = NextResponse.json({ connection })
    setActiveConnectionCookie(response, connection.id)
    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to activate connection"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
