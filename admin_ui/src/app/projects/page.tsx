"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  FolderKanban,
  Hexagon,
  Loader2,
  Plus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConfirmDialog } from "@/components/studio/confirm-dialog"
import { AdminLogoutButton } from "@/components/admin-logout-button"
import { EmptyState } from "@/components/studio/empty-state"
import type { InstanceDatabase, PlatformProject } from "@/lib/platform/types"
import { projectDefaultStudioPath } from "@/lib/platform/paths"

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<PlatformProject[]>([])
  const [databases, setDatabases] = useState<InstanceDatabase[]>([])
  const [loading, setLoading] = useState(true)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [mode, setMode] = useState<"link" | "create">("link")
  const [databaseName, setDatabaseName] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{
    type: "archive" | "delete"
    project: PlatformProject
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const availableDatabases = databases.filter((d) => !d.linked_project_id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const healthRes = await fetch("/api/platform/health", { cache: "no-store" })
      const health = await healthRes.json()
      if (!health.ok) {
        router.replace("/setup")
        return
      }

      const [projRes, dbRes] = await Promise.all([
        fetch(
          `/api/platform/projects?include_archived=${includeArchived}`,
          { cache: "no-store" }
        ),
        fetch("/api/platform/databases", { cache: "no-store" }),
      ])
      const projData = await projRes.json()
      const dbData = await dbRes.json()
      if (!projRes.ok) throw new Error(projData.error || "Failed to load projects")
      if (!dbRes.ok) throw new Error(dbData.error || "Failed to load databases")
      setProjects(projData.projects || [])
      const dbs = (dbData.databases || []) as InstanceDatabase[]
      setDatabases(dbs)
      setDatabaseName((prev) => {
        if (prev) return prev
        const first = dbs.find((d) => !d.linked_project_id)
        return first?.name || ""
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [includeArchived, router])

  useEffect(() => {
    void load()
  }, [load])

  async function openProject(id: string) {
    setOpeningId(id)
    try {
      const res = await fetch(`/api/platform/projects/${id}/open`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to open project")
      toast.success(`Opened ${data.project.name}`)
      router.push(projectDefaultStudioPath(id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Open failed")
    } finally {
      setOpeningId(null)
    }
  }

  async function archiveProject(project: PlatformProject) {
    setConfirm({ type: "archive", project })
  }

  async function removeProject(project: PlatformProject) {
    setConfirm({ type: "delete", project })
  }

  async function runConfirm() {
    if (!confirm) return
    setConfirmLoading(true)
    try {
      if (confirm.type === "archive") {
        const res = await fetch(`/api/platform/projects/${confirm.project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Archive failed")
        toast.success("Project archived")
      } else {
        const res = await fetch(`/api/platform/projects/${confirm.project.id}`, {
          method: "DELETE",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Delete failed")
        toast.success("Project deleted")
      }
      setConfirm(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setConfirmLoading(false)
    }
  }

  async function createProject() {
    const db =
      mode === "link" ? databaseName.trim() : databaseName.trim()
    if (!name.trim() || !db) {
      toast.error(
        mode === "link"
          ? "Name and an existing database are required"
          : "Name and new database name are required"
      )
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/platform/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          mode,
          database_name: db,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Create failed")
      toast.success(`Created ${data.project.name}`)
      setCreateOpen(false)
      setName("")
      setSlug("")
      setDescription("")
      setDatabaseName("")
      setMode("link")
      await load()
      await openProject(data.project.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.1_250_/_0.35),_transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Hexagon className="size-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
              <p className="text-sm text-muted-foreground">
                Each project opens one database on your Postgres instance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminLogoutButton />
            <Button
              variant={includeArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setIncludeArchived((v) => !v)}
            >
              <Archive className="size-3.5" />
              {includeArchived ? "Hide archived" : "Show archived"}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New project
            </Button>
          </div>
        </div>

        {!loading && !availableDatabases.length && mode === "link" ? (
          <Alert>
            <AlertDescription>
              No unlinked databases on the instance (system and platform DBs are
              hidden). Create a project with a{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setMode("create")
                  setCreateOpen(true)
                }}
              >
                new database
              </button>
              , or{" "}
              <Link href="/setup" className="underline">
                check setup
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading projects…
          </div>
        ) : !projects.length ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Link an existing database or create a new one for a project."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                New project
              </Button>
            }
            className="rounded-xl bg-card/50 py-16"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col rounded-xl border border-border/80 bg-card/80 p-4 shadow-lg shadow-black/10"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {project.slug}
                    </p>
                  </div>
                  <Badge
                    variant={
                      project.status === "active" ? "secondary" : "outline"
                    }
                    className="shrink-0 text-[10px] font-normal"
                  >
                    {project.status}
                  </Badge>
                </div>
                {project.description ? (
                  <p className="mb-1 line-clamp-2 text-xs text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
                <p className="mb-4 font-mono text-[10px] text-muted-foreground">
                  database: {project.database_name}
                </p>
                <div className="mt-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={
                      project.status !== "active" || openingId === project.id
                    }
                    onClick={() => void openProject(project.id)}
                  >
                    {openingId === project.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Open
                  </Button>
                  {project.status === "active" ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Archive"
                      onClick={() => void archiveProject(project)}
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Delete"
                    onClick={() => void removeProject(project)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/setup" className="underline underline-offset-2">
            Setup
          </Link>
        </p>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Link an existing database on the instance, or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "link" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setMode("link")
                  const first = availableDatabases[0]
                  if (first) setDatabaseName(first.name)
                  else setDatabaseName("")
                }}
              >
                Link existing
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "create" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setMode("create")
                  setDatabaseName("")
                }}
              >
                Create database
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Project name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Local app"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-slug">Slug (optional)</Label>
              <Input
                id="proj-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="local-app"
                className="font-mono text-xs"
              />
            </div>
            {mode === "link" ? (
              <div className="space-y-1.5">
                <Label>Database</Label>
                <Select
                  value={databaseName || undefined}
                  onValueChange={(v) => setDatabaseName(v ?? "")}
                  disabled={!availableDatabases.length}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a database" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDatabases.map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        {d.name} ({d.size})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="proj-db">New database name</Label>
                <Input
                  id="proj-db"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  placeholder="my_app"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Letters, numbers, underscore. Created on the master instance.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createProject()}
              disabled={
                saving ||
                (mode === "link" && !availableDatabases.length)
              }
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create & open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.type === "archive"
            ? `Archive "${confirm.project.name}"?`
            : `Delete "${confirm?.project.name}"?`
        }
        description={
          confirm?.type === "delete"
            ? "This removes the project from the platform. The database is not dropped."
            : "The project will be hidden from the active list. You can restore it later."
        }
        confirmLabel={confirm?.type === "archive" ? "Archive" : "Delete"}
        destructive={confirm?.type === "delete"}
        loading={confirmLoading}
        onConfirm={() => void runConfirm()}
      />
    </div>
  )
}
