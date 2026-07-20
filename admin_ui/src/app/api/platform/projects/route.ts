import { NextRequest, NextResponse } from "next/server"
import {
  buildDatabaseUrl,
  getMasterUrl,
  isPlatformConfigured,
} from "@/lib/platform/db"
import { createProject, listProjects } from "@/lib/platform/projects"
import { metaFetch, MetaApiError } from "@/lib/meta"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const includeArchived =
      request.nextUrl.searchParams.get("include_archived") === "true"
    const projects = await listProjects({ includeArchived })
    return NextResponse.json({ projects })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list projects",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const body = (await request.json()) as {
      name?: string
      slug?: string
      description?: string
      mode?: "link" | "create"
      database_name?: string
      color?: string
      read_only?: boolean
      test?: boolean
    }

    const mode = body.mode === "create" ? "create" : "link"
    const databaseName = body.database_name?.trim()
    if (!body.name?.trim() || !databaseName) {
      return NextResponse.json(
        { error: "name and database_name are required." },
        { status: 400 }
      )
    }

    const master = getMasterUrl()
    if (!master) {
      return NextResponse.json(
        { error: "PG_MASTER_URL is not configured." },
        { status: 500 }
      )
    }

    // For link mode, verify connectivity before creating the project row
    if (mode === "link" && body.test !== false) {
      const url = buildDatabaseUrl(master, databaseName)
      try {
        await metaFetch("/schemas?include_system_schemas=false", url)
      } catch (error) {
        const message =
          error instanceof MetaApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Connection test failed"
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    const project = await createProject({
      name: body.name,
      slug: body.slug,
      description: body.description,
      mode,
      database_name: databaseName,
      color: body.color,
      read_only: body.read_only,
    })

    if (mode === "create" && body.test !== false) {
      const url = buildDatabaseUrl(master, project.database_name)
      try {
        await metaFetch("/schemas?include_system_schemas=false", url)
      } catch (error) {
        const message =
          error instanceof MetaApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Connection test failed"
        return NextResponse.json(
          {
            error: `${message} (database and project were created; try Open)`,
            project,
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create project",
      },
      { status: 400 }
    )
  }
}
