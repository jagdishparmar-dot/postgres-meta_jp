"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Database,
  FileCode2,
  Loader2,
  Plus,
  TerminalSquare,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
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
import { useProject } from "@/lib/platform/project-context"
import {
  projectSqlPath,
  studioPath,
} from "@/lib/platform/paths"
import type { SqlSnippet } from "@/lib/platform/types"

export default function ProjectOverviewPage() {
  const router = useRouter()
  const { project, projectId } = useProject()
  const [snippets, setSnippets] = useState<SqlSnippet[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [sql, setSql] = useState("")
  const [saving, setSaving] = useState(false)

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
    if (!confirm(`Delete snippet "${snippet.title}"?`)) return
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
    await loadSnippets()
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.1_250_/_0.35),_transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-6">
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
            <h1 className="text-xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {project.description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            ) : null}
            <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <Database className="size-3.5" />
              {project.database_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/projects")}
            >
              All projects
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(studioPath(projectId, "/settings"))
              }
            >
              API keys
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(studioPath(projectId, "/sql"))
              }
            >
              <TerminalSquare className="size-3.5" />
              SQL Editor
            </Button>
            <Button
              size="sm"
              onClick={() =>
                router.push(studioPath(projectId, "/schemas"))
              }
            >
              Open Studio
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-lg shadow-black/10">
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
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : !snippets.length ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <FileCode2 className="mx-auto mb-2 size-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No snippets yet. Save queries from the SQL editor or create one
                here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {snippets.map((snippet) => (
                <li
                  key={snippet.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
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
                      onClick={() => void removeSnippet(snippet)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/projects" className="underline underline-offset-2">
            Back to projects
          </Link>
        </p>
      </div>

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
    </div>
  )
}
