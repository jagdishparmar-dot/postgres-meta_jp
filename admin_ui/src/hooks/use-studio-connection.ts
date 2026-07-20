"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { SavedConnection } from "@/lib/connection"
import { useOptionalProject } from "@/lib/platform/project-context"
import type { PlatformProject } from "@/lib/platform/types"

function toConnection(p: PlatformProject): SavedConnection {
  return {
    id: p.id,
    name: p.name,
    host: "master",
    port: "",
    database: p.database_name,
    user: "project",
    sslMode: "disable",
  }
}

export function useStudioConnection() {
  const router = useRouter()
  const projectCtx = useOptionalProject()
  const [connection, setConnection] = useState<SavedConnection | null>(null)
  const [project, setProject] = useState<PlatformProject | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (projectCtx?.project) {
      setProject(projectCtx.project)
      setConnection(toConnection(projectCtx.project))
      setReady(true)
      return projectCtx.project
    }

    try {
      const healthRes = await fetch("/api/platform/health", { cache: "no-store" })
      const health = await healthRes.json()
      if (!health.ok) {
        setProject(null)
        setConnection(null)
        setReady(false)
        router.replace("/setup")
        return null
      }

      const activeRes = await fetch("/api/platform/projects/active", {
        cache: "no-store",
      })
      const active = await activeRes.json()
      if (active.project) {
        const p = active.project as PlatformProject
        setProject(p)
        setConnection(toConnection(p))
        setReady(true)
        return p
      }

      setProject(null)
      setConnection(null)
      setReady(false)
      router.replace("/projects")
      return null
    } catch {
      setProject(null)
      setConnection(null)
      setReady(false)
      router.replace("/setup")
      return null
    }
  }, [router, projectCtx])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { connection, project, ready, refresh }
}
