import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { getProject } from "@/lib/platform/projects"
import {
  clearActiveProjectCookie,
  getActiveProjectId,
} from "@/lib/connection-session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (!isPlatformConfigured()) {
    return NextResponse.json({ project: null })
  }
  const id = getActiveProjectId(request)
  if (!id) {
    return NextResponse.json({ project: null })
  }
  try {
    const project = await getProject(id)
    if (!project || project.status !== "active") {
      const response = NextResponse.json({ project: null })
      clearActiveProjectCookie(response)
      return response
    }
    return NextResponse.json({ project })
  } catch {
    return NextResponse.json({ project: null })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearActiveProjectCookie(response)
  return response
}
