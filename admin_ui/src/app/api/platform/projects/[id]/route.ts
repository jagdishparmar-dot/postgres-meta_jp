import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/platform/projects"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  const { id } = await context.params
  const project = await getProject(id)
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }
  return NextResponse.json({ project })
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
    const project = await updateProject(id, body)
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 })
    }
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update project",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  if (!isPlatformConfigured()) {
    return NextResponse.json(
      { error: "Platform is not configured." },
      { status: 503 }
    )
  }
  const { id } = await context.params
  const ok = await deleteProject(id)
  if (!ok) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
