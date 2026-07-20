"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { StorageShell } from "@/components/studio/pages/storage-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/lib/platform/project-context"
import type { StorageAuditEntry } from "@/lib/storage/schema"

export function StorageAuditPageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [entries, setEntries] = useState<StorageAuditEntry[]>([])
  const [action, setAction] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "200" })
      if (action.trim()) qs.set("action", action.trim())
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/audit?${qs}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load audit log")
      setEntries(data.entries || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId, action])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <StorageShell
      title="Storage audit log"
      subtitle="Uploads, deletes, policy changes, scans, and repairs"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-48"
            placeholder="Filter action…"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No audit entries
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Bucket</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2">{e.bucket_name || "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs">
                    {e.object_path || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.actor || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StorageShell>
  )
}
