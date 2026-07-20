import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import {
  markProjectOpened,
  resolveProjectConnectionString,
} from "@/lib/platform/projects"
import {
  clearActiveConnectionCookie,
  setActiveProjectCookie,
} from "@/lib/connection-session"
import { metaFetch, MetaApiError } from "@/lib/meta"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }

  try {
    const { id } = await context.params
    const resolved = await resolveProjectConnectionString(id)
    if (!resolved) {
      return NextResponse.json(
        { error: "Project not found or archived." },
        { status: 404 }
      )
    }

    try {
      await metaFetch(
        "/schemas?include_system_schemas=false",
        resolved.connectionString
      )
    } catch (error) {
      const message =
        error instanceof MetaApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to connect to project database"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    await markProjectOpened(id)
    const response = NextResponse.json({
      ok: true,
      project: resolved.project,
    })
    setActiveProjectCookie(response, id)
    clearActiveConnectionCookie(response)
    return response
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to open project",
      },
      { status: 400 }
    )
  }
}
