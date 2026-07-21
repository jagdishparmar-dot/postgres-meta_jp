/** Build Studio paths under `/projects/[id]/database/...`. */

export function studioPath(projectId: string, path = ""): string {
  const base = `/projects/${projectId}/database`
  if (!path || path === "/") return base
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

export function projectOverviewPath(projectId: string): string {
  return `/projects/${projectId}`
}

/** Default Studio entry when opening a project (Supabase-style). */
export function projectDefaultStudioPath(projectId: string): string {
  return studioPath(projectId, "/schemas")
}

export function projectSettingsPath(projectId: string): string {
  return studioPath(projectId, "/settings")
}

export function projectRedisPath(projectId: string): string {
  return studioPath(projectId, "/redis")
}

export function projectSqlPath(
  projectId: string,
  opts?: { snippet?: string }
): string {
  const base = studioPath(projectId, "/sql")
  if (!opts?.snippet) return base
  return `${base}?snippet=${encodeURIComponent(opts.snippet)}`
}

/** Map a legacy `/database/...` path to the nested Studio path. */
export function nestDatabasePath(
  projectId: string,
  pathname: string
): string {
  const prefix = "/database"
  if (pathname === prefix || pathname === `${prefix}/`) {
    return studioPath(projectId, "/schemas")
  }
  if (pathname.startsWith(`${prefix}/`)) {
    return studioPath(projectId, pathname.slice(prefix.length))
  }
  return studioPath(projectId, "/schemas")
}
