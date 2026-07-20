"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { runQuery } from "@/lib/sql"

type LogSettings = Record<string, string>
type ActivityLog = {
  pid: number
  usename: string | null
  application_name: string | null
  client_addr: string | null
  state: string | null
  query_start: string | null
  query: string | null
}

export function LogsPageClient() {
  const { connection, ready } = useStudioConnection()
  const [settings, setSettings] = useState<LogSettings>({})
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, activityRes] = await Promise.all([
        runQuery(`
SELECT name, setting
FROM pg_settings
WHERE name IN (
  'log_destination', 'logging_collector', 'log_directory', 'log_filename',
  'log_min_messages', 'log_statement', 'log_min_duration_statement',
  'log_line_prefix', 'log_timezone'
)
ORDER BY name`),
        runQuery(`
SELECT pid, usename, application_name, host(client_addr)::text AS client_addr,
       state, query_start::text, left(query, 500) AS query
FROM pg_stat_activity
WHERE backend_type = 'client backend'
  AND pid <> pg_backend_pid()
ORDER BY query_start DESC NULLS LAST
LIMIT 100`),
      ])

      const next: LogSettings = {}
      for (const row of settingsRes.rows) {
        next[String(row.name)] = String(row.setting ?? "")
      }
      setSettings(next)
      setActivity(activityRes.rows as unknown as ActivityLog[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load logs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <StudioShell
      connection={connection}
      title="Logs"
      subtitle="Logging settings + recent session activity (server log files need host access)"
      refreshing={loading}
      onRefresh={() => void load()}
      toolbar={
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </Button>
      }
    >
      <div className="space-y-4 p-4">
        <Alert>
          <AlertDescription className="text-xs">
            Full PostgreSQL log file tailing is not available over the SQL API alone.
            This view shows logging GUCs and live{" "}
            <code className="text-[11px]">pg_stat_activity</code> as an activity log.
          </AlertDescription>
        </Alert>

        <div>
          <h3 className="mb-2 text-sm font-medium">Logging settings</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(settings).map(([name, value]) => (
              <div
                key={name}
                className="rounded-md border border-border bg-muted/20 px-3 py-2"
              >
                <p className="font-mono text-[10px] text-muted-foreground">{name}</p>
                <p className="truncate font-mono text-xs">{value || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-medium">Recent activity</h3>
            <Badge variant="secondary" className="font-normal">
              {activity.length}
            </Badge>
          </div>
          <div className="overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>PID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Query</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!activity.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No other client backends
                    </TableCell>
                  </TableRow>
                ) : (
                  activity.map((row) => (
                    <TableRow key={row.pid}>
                      <TableCell className="font-mono text-xs">{row.pid}</TableCell>
                      <TableCell className="text-xs">{row.usename || "—"}</TableCell>
                      <TableCell className="text-xs">{row.state || "—"}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                        {row.application_name || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-md truncate font-mono text-[11px]"
                        title={row.query || ""}
                      >
                        {row.query || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </StudioShell>
  )
}
