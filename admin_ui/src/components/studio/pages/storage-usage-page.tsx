"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  formatBytes,
  StorageShell,
} from "@/components/studio/pages/storage-shell"
import { Button } from "@/components/ui/button"
import { useProject } from "@/lib/platform/project-context"

type Usage = {
  buckets: { id: string; name: string; object_count: number; total_bytes: number }[]
  total_bytes: number
  total_objects: number
  quota_bytes: number | null
  quota_used_pct: number | null
}

export function StorageUsagePageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/usage`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load usage")
      setUsage(data.usage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <StorageShell
      title="Storage usage"
      subtitle="Per-bucket size and project quota"
      toolbar={
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      }
    >
      {loading || !usage ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-3">
              <div className="text-xs text-muted-foreground">Total size</div>
              <div className="text-lg font-semibold">
                {formatBytes(usage.total_bytes)}
              </div>
            </div>
            <div className="rounded-md border border-border px-3 py-3">
              <div className="text-xs text-muted-foreground">Objects</div>
              <div className="text-lg font-semibold">{usage.total_objects}</div>
            </div>
            <div className="rounded-md border border-border px-3 py-3">
              <div className="text-xs text-muted-foreground">Quota</div>
              <div className="text-lg font-semibold">
                {usage.quota_bytes != null
                  ? `${usage.quota_used_pct ?? 0}% of ${formatBytes(usage.quota_bytes)}`
                  : "Unlimited"}
              </div>
              {usage.quota_bytes != null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, usage.quota_used_pct || 0)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Objects</th>
                  <th className="px-3 py-2">Size</th>
                </tr>
              </thead>
              <tbody>
                {usage.buckets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No buckets
                    </td>
                  </tr>
                ) : (
                  usage.buckets.map((b) => (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="px-3 py-2 font-medium">{b.name}</td>
                      <td className="px-3 py-2">{b.object_count}</td>
                      <td className="px-3 py-2">{formatBytes(b.total_bytes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StorageShell>
  )
}
