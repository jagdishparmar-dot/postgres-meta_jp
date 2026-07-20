"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  Ban,
  HardDrive,
  Loader2,
  OctagonX,
  RefreshCw,
  Timer,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import { studioPath } from "@/lib/platform/paths"
import {
  cancelBackend,
  fetchActivity,
  fetchSlowQueries,
  fetchTableSizes,
  runMaintenance,
  terminateBackend,
  type ActivityRow,
  type LockRow,
  type MaintenanceAction,
  type SlowQueryRow,
  type TableSizeRow,
} from "@/lib/ops"
import { cn } from "@/lib/utils"

type Tab = "activity" | "sizes" | "slow" | "maintenance"

export function OpsPageClient() {
  const router = useRouter()
  const { projectId } = useProject()
  const { connection, ready } = useStudioConnection()
  const [tab, setTab] = useState<Tab>("activity")
  const [loading, setLoading] = useState(false)

  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [locks, setLocks] = useState<LockRow[]>([])
  const [sizes, setSizes] = useState<TableSizeRow[]>([])
  const [slow, setSlow] = useState<SlowQueryRow[]>([])
  const [slowError, setSlowError] = useState<string | null>(null)
  const [sizeFilter, setSizeFilter] = useState("")
  const [busyPid, setBusyPid] = useState<number | null>(null)
  const [busyTable, setBusyTable] = useState<string | null>(null)

  const loadActivity = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchActivity()
      setActivity(data.activity)
      setLocks(data.locks)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load activity")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSizes = useCallback(async () => {
    setLoading(true)
    try {
      setSizes(await fetchTableSizes())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sizes")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSlow = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSlowQueries(50)
      setSlow(data.rows)
      setSlowError(data.error || null)
    } catch (err) {
      setSlow([])
      setSlowError(err instanceof Error ? err.message : "Failed to load stats")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !connection) return
    if (tab === "activity") void loadActivity()
    if (tab === "sizes" || tab === "maintenance") void loadSizes()
    if (tab === "slow") void loadSlow()
  }, [ready, connection, tab, loadActivity, loadSizes, loadSlow])

  const filteredSizes = useMemo(() => {
    const q = sizeFilter.trim().toLowerCase()
    if (!q) return sizes
    return sizes.filter(
      (r) =>
        r.schema.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    )
  }, [sizes, sizeFilter])

  async function onCancel(pid: number) {
    if (!confirm(`Cancel backend ${pid}?`)) return
    setBusyPid(pid)
    try {
      const ok = await cancelBackend(pid)
      toast.success(ok ? `Cancel sent to ${pid}` : `Cancel returned false`)
      await loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed")
    } finally {
      setBusyPid(null)
    }
  }

  async function onTerminate(pid: number) {
    if (!confirm(`Terminate backend ${pid}? This forcefully ends the session.`))
      return
    setBusyPid(pid)
    try {
      const ok = await terminateBackend(pid)
      toast.success(ok ? `Terminated ${pid}` : `Terminate returned false`)
      await loadActivity()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terminate failed")
    } finally {
      setBusyPid(null)
    }
  }

  async function onMaintain(
    schema: string,
    name: string,
    action: MaintenanceAction
  ) {
    const key = `${schema}.${name}:${action}`
    setBusyTable(key)
    try {
      await runMaintenance(schema, name, action)
      toast.success(
        `${action.replace("_", " ")} completed on ${schema}.${name}`
      )
      await loadSizes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Maintenance failed")
    } finally {
      setBusyTable(null)
    }
  }

  function refresh() {
    if (tab === "activity") void loadActivity()
    if (tab === "sizes" || tab === "maintenance") void loadSizes()
    if (tab === "slow") void loadSlow()
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading connection…
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "activity", label: "Activity", icon: Activity },
    { id: "sizes", label: "Table sizes", icon: HardDrive },
    { id: "slow", label: "Slow queries", icon: Timer },
    { id: "maintenance", label: "Vacuum / Analyze", icon: Wrench },
  ]

  return (
    <StudioShell
      connection={connection}
      title="Ops & observability"
      subtitle="Activity, sizes, slow queries, and maintenance"
      refreshing={loading}
      onRefresh={refresh}
      toolbar={
        <>
          <div className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <Button
                  key={t.id}
                  size="sm"
                  variant={tab === t.id ? "default" : "ghost"}
                  onClick={() => setTab(t.id)}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </Button>
              )
            })}
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </>
      }
    >
      <div className="p-3">
        {tab === "activity" ? (
          <div className="space-y-4">
            <section className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Active sessions</p>
                <Badge variant="secondary" className="font-normal">
                  {activity.length}
                </Badge>
              </div>
              {!activity.length ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No other sessions in this database
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24">Actions</TableHead>
                        <TableHead>PID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Wait</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Query</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activity.map((row) => (
                        <TableRow key={row.pid}>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                title="Cancel (SIGINT)"
                                disabled={busyPid === row.pid}
                                onClick={() => void onCancel(row.pid)}
                              >
                                {busyPid === row.pid ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Ban className="size-3" />
                                )}
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                title="Terminate"
                                disabled={busyPid === row.pid}
                                onClick={() => void onTerminate(row.pid)}
                              >
                                <OctagonX className="size-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.pid}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.usename || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {row.state || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {[row.wait_event_type, row.wait_event]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.duration || "—"}
                          </TableCell>
                          <TableCell className="max-w-[360px] truncate font-mono text-[11px]">
                            {row.query || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-medium">Locks</p>
                <Badge variant="secondary" className="font-normal">
                  {locks.length}
                </Badge>
              </div>
              {!locks.length ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No locks for this database
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>PID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Granted</TableHead>
                        <TableHead>Relation</TableHead>
                        <TableHead>Query</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locks.map((row, i) => (
                        <TableRow key={`${row.pid}-${row.locktype}-${i}`}>
                          <TableCell className="font-mono text-xs">
                            {row.pid}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.usename || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.locktype}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.mode}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.granted ? "secondary" : "destructive"}
                              className="text-[10px] font-normal"
                            >
                              {row.granted ? "yes" : "waiting"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.relation || "—"}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate font-mono text-[11px] text-muted-foreground">
                            {row.query || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {tab === "sizes" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                placeholder="Filter tables…"
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                {filteredSizes.length} tables · sorted by total size
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Table</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Heap</TableHead>
                      <TableHead>Indexes</TableHead>
                      <TableHead className="text-right">Live</TableHead>
                      <TableHead className="text-right">Dead</TableHead>
                      <TableHead className="text-right">Dead %</TableHead>
                      <TableHead>Last vacuum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSizes.map((row) => (
                      <TableRow
                        key={`${row.schema}.${row.name}`}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(
                            studioPath(
                              projectId,
                              `/tables/${encodeURIComponent(row.schema)}/${encodeURIComponent(row.name)}`
                            )
                          )
                        }
                      >
                        <TableCell className="font-mono text-xs">
                          {row.schema}.{row.name}
                        </TableCell>
                        <TableCell className="text-xs">{row.total_size}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.table_size}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.index_size}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.live_rows.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.dead_rows.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span
                            className={cn(
                              row.dead_pct >= 20 && "text-destructive"
                            )}
                          >
                            {row.dead_pct}%
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                          {row.last_autovacuum || row.last_vacuum || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "slow" ? (
          <div className="space-y-3">
            {slowError ? (
              <Alert>
                <AlertDescription className="text-sm">{slowError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-border">
              {!slow.length && !slowError ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No statement stats yet
                </p>
              ) : slow.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Mean ms</TableHead>
                        <TableHead className="text-right">Total ms</TableHead>
                        <TableHead className="text-right">Rows</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slow.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="max-w-[480px] font-mono text-[11px]">
                            <span className="line-clamp-2">{row.query}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.calls.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.mean_ms}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.total_ms.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.rows.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "maintenance" ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="text-sm">
                VACUUM / ANALYZE run on the selected table. Prefer VACUUM ANALYZE
                for dead-tuple cleanup + planner stats. High dead % tables are
                listed first.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                placeholder="Filter tables…"
                className="max-w-xs"
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Dead %</TableHead>
                      <TableHead className="text-right">Dead rows</TableHead>
                      <TableHead>Last analyze</TableHead>
                      <TableHead className="w-[280px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...filteredSizes]
                      .sort((a, b) => b.dead_pct - a.dead_pct)
                      .map((row) => {
                        const keyBase = `${row.schema}.${row.name}`
                        return (
                          <TableRow key={keyBase}>
                            <TableCell className="font-mono text-xs">
                              {keyBase}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              <span
                                className={cn(
                                  row.dead_pct >= 20 && "text-destructive"
                                )}
                              >
                                {row.dead_pct}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {row.dead_rows.toLocaleString()}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                              {row.last_autoanalyze || row.last_analyze || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(
                                  [
                                    ["analyze", "Analyze"],
                                    ["vacuum", "Vacuum"],
                                    ["vacuum_analyze", "Vacuum analyze"],
                                  ] as const
                                ).map(([action, label]) => {
                                  const key = `${keyBase}:${action}`
                                  return (
                                    <Button
                                      key={action}
                                      size="sm"
                                      variant="outline"
                                      disabled={busyTable === key}
                                      onClick={() =>
                                        void onMaintain(
                                          row.schema,
                                          row.name,
                                          action
                                        )
                                      }
                                    >
                                      {busyTable === key ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : null}
                                      {label}
                                    </Button>
                                  )
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </StudioShell>
  )
}
