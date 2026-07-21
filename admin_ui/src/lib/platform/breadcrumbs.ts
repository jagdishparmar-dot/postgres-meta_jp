import {
  projectOverviewPath,
  studioPath,
} from "@/lib/platform/paths"

export type BreadcrumbSegment = {
  label: string
  href?: string
}

const MODULE_LABELS: Record<string, string> = {
  editor: "Table Editor",
  sql: "SQL Editor",
  database: "Database",
  storage: "Storage",
  redis: "Redis",
  ops: "Ops",
  home: "Home",
}

const PATH_LABELS: Record<string, string> = {
  "/schemas": "Schemas",
  "/tables": "Tables",
  "/views": "Views",
  "/materialized-views": "Materialized views",
  "/foreign-tables": "Foreign tables",
  "/sql": "SQL Editor",
  "/functions": "Functions",
  "/types": "Types",
  "/roles": "Roles",
  "/policies": "Policies",
  "/privileges": "Privileges",
  "/indexes": "Indexes",
  "/triggers": "Triggers",
  "/extensions": "Extensions",
  "/publications": "Publications",
  "/diagram": "ER diagram",
  "/generators": "Generators",
  "/cron": "Cron",
  "/pg-net": "HTTP (pg_net)",
  "/config": "Config",
  "/logs": "Logs",
  "/backup": "Backup",
  "/settings": "API & settings",
  "/storage": "Buckets",
  "/storage/policies": "Policies",
  "/storage/security": "Security",
  "/storage/usage": "Usage",
  "/storage/orphans": "Orphans",
  "/storage/lifecycle": "Lifecycle",
  "/storage/audit": "Audit log",
  "/redis": "Redis",
  "/ops": "Ops hub",
}

function detectModuleId(pathname: string, projectId: string): string {
  if (pathname === projectOverviewPath(projectId)) return "home"
  const base = `/projects/${projectId}/database`
  if (!pathname.startsWith(base)) return "database"
  const rest = pathname.slice(base.length) || "/"
  const paths = Object.keys(PATH_LABELS).sort((a, b) => b.length - a.length)
  for (const p of paths) {
    if (rest === p || rest.startsWith(`${p}/`)) {
      if (p.startsWith("/storage")) return "storage"
      if (p.startsWith("/redis")) return "redis"
      if (p.startsWith("/ops")) return "ops"
      if (p === "/sql") return "sql"
      if (
        ["/tables", "/views", "/materialized-views", "/foreign-tables"].some(
          (x) => rest === x || rest.startsWith(`${x}/`)
        )
      ) {
        return "editor"
      }
      return "database"
    }
  }
  return "database"
}

export function buildStudioBreadcrumbs(opts: {
  pathname: string
  projectId: string
  projectName: string
  pageTitle: string
}): BreadcrumbSegment[] {
  const { pathname, projectId, projectName, pageTitle } = opts
  const overview = projectOverviewPath(projectId)
  const base = `/projects/${projectId}/database`

  if (pathname === overview) {
    return [{ label: projectName, href: overview }, { label: "Home" }]
  }

  if (!pathname.startsWith(base)) {
    return [{ label: projectName }, { label: pageTitle }]
  }

  const rest = pathname.slice(base.length) || "/"
  const moduleId = detectModuleId(pathname, projectId)
  const moduleLabel = MODULE_LABELS[moduleId] || "Database"

  const crumbs: BreadcrumbSegment[] = [
    { label: projectName, href: overview },
    { label: moduleLabel, href: studioPath(projectId, moduleDefaultPath(moduleId)) },
  ]

  const pathLabel = labelForPath(rest)
  if (pathLabel && pathLabel !== moduleLabel && pathLabel !== pageTitle) {
    crumbs.push({ label: pathLabel, href: studioPath(projectId, rest.split("/").slice(0, 3).join("/") || rest) })
  }

  if (pageTitle && pageTitle !== pathLabel && pageTitle !== moduleLabel) {
    crumbs.push({ label: pageTitle })
  } else if (pathLabel && pathLabel !== moduleLabel) {
    crumbs[crumbs.length - 1] = { label: pathLabel }
  }

  return crumbs
}

function moduleDefaultPath(moduleId: string): string {
  switch (moduleId) {
    case "editor":
      return "/tables"
    case "sql":
      return "/sql"
    case "storage":
      return "/storage"
    case "redis":
      return "/redis"
    case "ops":
      return "/ops"
    default:
      return "/schemas"
  }
}

function labelForPath(rest: string): string | null {
  const paths = Object.keys(PATH_LABELS).sort((a, b) => b.length - a.length)
  for (const p of paths) {
    if (rest === p || rest.startsWith(`${p}/`)) return PATH_LABELS[p]
  }
  return null
}
