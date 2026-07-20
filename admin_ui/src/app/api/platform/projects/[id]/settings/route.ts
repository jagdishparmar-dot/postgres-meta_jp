import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import {
  getProjectApiSettings,
  rotateProjectApiKeys,
  updateProjectApiSettings,
} from "@/lib/platform/project-settings"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    const settings = await getProjectApiSettings(id)
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        database_name: project.database_name,
      },
      settings,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load settings",
      },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  try {
    const { id } = await context.params
    const body = await request.json()
    if (body.action === "rotate_keys") {
      const settings = await rotateProjectApiKeys(id)
      return NextResponse.json({ settings })
    }
    const settings = await updateProjectApiSettings(id, {
      api_url: body.api_url,
      cors_allowed_origins: body.cors_allowed_origins,
    })
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 400 }
    )
  }
}
