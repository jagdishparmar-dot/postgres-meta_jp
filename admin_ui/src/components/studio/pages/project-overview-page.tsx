"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Database,
  FileCode2,
  HardDrive,
  Loader2,
  MemoryStick,
  Plus,
  Settings2,
  Table2,
  TerminalSquare,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { ConfirmDialog } from "@/components/studio/confirm-dialog"
import { EmptyState } from "@/components/studio/empty-state"
import { PageLoader } from "@/components/studio/page-loader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import { projectDefaultStudioPath, projectSqlPath, studioPath } from "@/lib/platform/paths"
import type { SqlSnippet } from "@/lib/platform/types"

const QUICK_LINKS = [
  { path: "/schemas", label: "Database", icon: Database },
  { path: "/sql", label: "SQL Editor", icon: TerminalSquare },
  { path: "/tables", label: "Tables", icon: Table2 },
  { path: "/storage", label: "Storage", icon: HardDrive },
  { path: "/redis", label: "Redis", icon: MemoryStick },
  { path: "/settings", label: "API settings", icon: Settings2 },
] as const

export function ProjectOverviewPageClient() {
  const router = useRouter()
  const { project, projectId } = useProject()
  const { connection, ready } = useStudioConnection()
  const [snippets, setSnippets] = useState<SqlSnippet[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [sql, setSql] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteSnippet, setDeleteSnippet] = useState<SqlSnippet | null>(null)

  const loadSnippets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/projects/${projectId}/snippets`,
        { cache: "no-store" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load snippets")
      setSnippets(data.snippets || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load snippets")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadSnippets()
  }, [loadSnippets])

  async function createSnippet() {
    if (!title.trim() || !sql.trim()) {
      toast.error("Title and SQL are required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), sql: sql.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      toast.success("Snippet saved")
      setCreateOpen(false)
      setTitle("")
      setSql("")
      await loadSnippets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function removeSnippet(snippet: SqlSnippet) {
    const res = await fetch(
      `/api/platform/projects/${projectId}/snippets/${snippet.id}`,
      { method: "DELETE" }
    )
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Delete failed")
      return
    }
    toast.success("Snippet deleted")
    setDeleteSnippet(null)
    await loadSnippets()
  }

  if (!ready || !connection) {
    return <PageLoader label="Opening project…" className="min-h-svh" />
  }

  return (
    <>
      <StudioShell
        connection={connection}
        title="Home"
        subtitle={`${project.name} · ${project.database_name}`}
        onRefresh={() => void loadSnippets()}
        refreshing={loading}
      >
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {project.status}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {project.slug}
                </span>
              </div>
              {project.description ? (
                <p className="text-sm text-muted-foreground">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Project overview and saved SQL snippets.
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => router.push(projectDefaultStudioPath(projectId))}
            >
              Open Studio
            </Button>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Quick links
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {QUICK_LINKS.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  href={studioPath(projectId, path)}
                  className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">SQL snippets</h2>
                <p className="text-xs text-muted-foreground">
                  Saved queries for this project
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                New snippet
              </Button>
            </div>

            {loading ? (
              <PageLoader />
            ) : !snippets.length ? (
              <EmptyState
                icon={FileCode2}
                title="No snippets yet"
                description="Save queries from the SQL editor or create one here."
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    New snippet
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border/80">
                {snippets.map((snippet) => (
                  <li
                    key={snippet.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 first:pt-3 last:pb-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {snippet.title}
                      </p>
                      <pre className="mt-1 max-h-16 overflow-hidden font-mono text-[11px] text-muted-foreground">
                        {snippet.sql}
                      </pre>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            projectSqlPath(projectId, { snippet: snippet.id })
                          )
                        }
                      >
                        Open
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Delete"
                        onClick={() => setDeleteSnippet(snippet)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </StudioShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New SQL snippet</DialogTitle>
            <DialogDescription>
              Store a reusable query for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="snip-title">Title</Label>
              <Input
                id="snip-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="List active users"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snip-sql">SQL</Label>
              <Textarea
                id="snip-sql"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder="select * from …"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createSnippet()} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteSnippet)}
        onOpenChange={(open) => !open && setDeleteSnippet(null)}
        title={`Delete "${deleteSnippet?.title}"?`}
        description="This snippet will be removed from the project."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteSnippet) await removeSnippet(deleteSnippet)
        }}
      />
    </>
  )
}
