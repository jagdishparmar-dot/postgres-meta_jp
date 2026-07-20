import { NextRequest, NextResponse } from "next/server"
import { isPlatformConfigured } from "@/lib/platform/db"
import { resolveProjectConnectionString } from "@/lib/platform/projects"

export const ACTIVE_CONNECTION_COOKIE = "pgadmin_active_connection"
export const ACTIVE_PROJECT_COOKIE = "pgadmin_active_project"

export function getActiveConnectionId(
  request: NextRequest
): string | undefined {
  return request.cookies.get(ACTIVE_CONNECTION_COOKIE)?.value
}

export function getActiveProjectId(request: NextRequest): string | undefined {
  return request.cookies.get(ACTIVE_PROJECT_COOKIE)?.value
}

export function setActiveConnectionCookie(
  response: NextResponse,
  id: string
) {
  response.cookies.set(ACTIVE_CONNECTION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function setActiveProjectCookie(response: NextResponse, id: string) {
  response.cookies.set(ACTIVE_PROJECT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearActiveConnectionCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_CONNECTION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  })
}

export function clearActiveProjectCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_PROJECT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  })
}

/**
 * Prefer active project (master URL + project.database_name) → header.
 */
export async function resolveConnectionString(
  request: NextRequest
): Promise<string | null> {
  const projectId = getActiveProjectId(request)
  if (projectId && isPlatformConfigured()) {
    try {
      const resolved = await resolveProjectConnectionString(projectId)
      if (resolved) return resolved.connectionString
    } catch {
      // fall through
    }
  }

  return request.headers.get("x-connection-string")
}
