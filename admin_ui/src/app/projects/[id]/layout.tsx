"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ProjectProvider } from "@/lib/platform/project-context"
import type { PlatformProject } from "@/lib/platform/types"

export default function ProjectIdLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id
  const [project, setProject] = useState<PlatformProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    void (async () => {
      setReady(false)
      setError(null)
      try {
        const healthRes = await fetch("/api/platform/health", {
          cache: "no-store",
        })
        const health = await healthRes.json()
        if (!health.ok) {
          router.replace("/setup")
          return
        }

        const openRes = await fetch(`/api/platform/projects/${projectId}/open`, {
          method: "POST",
        })
        const openData = await openRes.json()
        if (!openRes.ok) {
          throw new Error(openData.error || "Failed to open project")
        }
        if (cancelled) return
        setProject(openData.project as PlatformProject)
        setReady(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load project")
        setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, router])

  if (!ready || (!project && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Opening project…
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-destructive">{error || "Project not found"}</p>
        <button
          type="button"
          className="text-sm underline underline-offset-2"
          onClick={() => router.push("/projects")}
        >
          Back to projects
        </button>
      </div>
    )
  }

  return <ProjectProvider project={project}>{children}</ProjectProvider>
}
