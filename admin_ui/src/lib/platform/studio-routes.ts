/** Default Studio page titles from nested database paths. */

const PATH_META: Record<string, { title: string; subtitle?: string }> = {
  "/schemas": { title: "Schemas", subtitle: "Create, rename, and drop schemas" },
  "/tables": { title: "Tables", subtitle: "Tables in the connected database" },
  "/views": { title: "Views" },
  "/materialized-views": { title: "Materialized views" },
  "/foreign-tables": { title: "Foreign tables" },
  "/sql": {
    title: "SQL Editor",
    subtitle: "Run queries · Ctrl/⌘+Enter · select text to run selection",
  },
  "/functions": { title: "Functions" },
  "/types": { title: "Types" },
  "/roles": { title: "Roles" },
  "/policies": { title: "Policies" },
  "/privileges": { title: "Privileges" },
  "/indexes": { title: "Indexes" },
  "/triggers": { title: "Triggers" },
  "/extensions": { title: "Extensions" },
  "/publications": { title: "Publications" },
  "/diagram": { title: "ER diagram" },
  "/generators": { title: "Generators" },
  "/cron": { title: "Cron", subtitle: "pg_cron — schedule SQL jobs" },
  "/pg-net": { title: "HTTP (pg_net)", subtitle: "Outbound HTTP from Postgres" },
  "/config": { title: "Config" },
  "/logs": { title: "Logs" },
  "/backup": { title: "Backup" },
  "/settings": { title: "API & settings" },
  "/storage": { title: "Storage", subtitle: "Buckets and objects" },
  "/storage/policies": { title: "Storage policies" },
  "/storage/security": { title: "Storage security" },
  "/storage/usage": { title: "Storage usage" },
  "/storage/orphans": { title: "Storage orphans" },
  "/storage/lifecycle": { title: "Lifecycle rules" },
  "/storage/audit": { title: "Audit log" },
  "/redis": {
    title: "Redis",
    subtitle: "Shared Redis — logical DB 0–15 per project",
  },
  "/ops": { title: "Ops hub" },
}

export function getStudioRouteMeta(pathname: string): {
  title: string
  subtitle?: string
} {
  const match = pathname.match(/\/projects\/[^/]+\/database(\/.*)?$/)
  const rest = match?.[1] || "/schemas"
  const paths = Object.keys(PATH_META).sort((a, b) => b.length - a.length)
  for (const p of paths) {
    if (rest === p || rest.startsWith(`${p}/`)) {
      return PATH_META[p]
    }
  }
  return { title: "Studio" }
}
