"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Wrench } from "lucide-react"
import { toast } from "sonner"
import {
  formatBytes,
  StorageShell,
} from "@/components/studio/pages/storage-shell"
import { Button } from "@/components/ui/button"
import { useProject } from "@/lib/platform/project-context"
import type { OrphanReport } from "@/lib/storage/ops"

export function StorageOrphansPageClient() {
  const { project } = useProject()
  const projectId = project?.id
  const [reports, setReports] = useState<OrphanReport[]>([])
  const [loading, setLoading] = useState(true)
  const [repairing, setRepairing] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/orphans`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Scan failed")
      setReports(data.reports || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function repair(
    bucketId: string,
    opts: { deleteDbOrphans?: boolean; deleteS3Orphans?: boolean }
  ) {
    if (!projectId) return
    setRepairing(bucketId)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/storage/orphans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucketId, ...opts }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Repair failed")
      toast.success(
        `Removed ${data.deleted_db} DB + ${data.deleted_s3} S3 orphans`
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Repair failed")
    } finally {
      setRepairing(null)
    }
  }

  return (
    <StorageShell
      title="Orphan repair"
      subtitle="Compare project DB metadata with RustFS keys"
      toolbar={
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
          Rescan
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Scanning…
        </div>
      ) : reports.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No buckets to scan
        </p>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const clean =
              r.db_orphans.length === 0 && r.s3_orphans.length === 0
            return (
              <div
                key={r.bucket_id}
                className="rounded-md border border-border p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.bucket_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {clean
                        ? "In sync"
                        : `${r.db_orphans.length} DB orphans · ${r.s3_orphans.length} S3 orphans`}
                    </div>
                  </div>
                  {!clean ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          repairing === r.bucket_id ||
                          r.db_orphans.length === 0
                        }
                        onClick={() =>
                          void repair(r.bucket_id, { deleteDbOrphans: true })
                        }
                      >
                        <Wrench className="size-3.5" />
                        Drop DB orphans
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          repairing === r.bucket_id ||
                          r.s3_orphans.length === 0
                        }
                        onClick={() => {
                          if (
                            !confirm(
                              "Delete RustFS objects with no DB row? This cannot be undone."
                            )
                          ) {
                            return
                          }
                          void repair(r.bucket_id, { deleteS3Orphans: true })
                        }}
                      >
                        <Wrench className="size-3.5" />
                        Drop S3 orphans
                      </Button>
                    </div>
                  ) : null}
                </div>
                {!clean ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        In DB, missing in RustFS
                      </div>
                      <ul className="max-h-40 overflow-auto rounded border border-border/60 text-xs">
                        {r.db_orphans.length === 0 ? (
                          <li className="px-2 py-2 text-muted-foreground">
                            None
                          </li>
                        ) : (
                          r.db_orphans.map((o) => (
                            <li
                              key={o.id}
                              className="border-b border-border/40 px-2 py-1 font-mono"
                            >
                              {o.name}{" "}
                              <span className="text-muted-foreground">
                                ({formatBytes(o.size)})
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        In RustFS, missing in DB
                      </div>
                      <ul className="max-h-40 overflow-auto rounded border border-border/60 text-xs">
                        {r.s3_orphans.length === 0 ? (
                          <li className="px-2 py-2 text-muted-foreground">
                            None
                          </li>
                        ) : (
                          r.s3_orphans.map((o) => (
                            <li
                              key={o.name}
                              className="border-b border-border/40 px-2 py-1 font-mono"
                            >
                              {o.name}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </StorageShell>
  )
}
