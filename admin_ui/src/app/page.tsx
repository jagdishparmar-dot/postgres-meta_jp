"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { projectOverviewPath } from "@/lib/platform/paths"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    void (async () => {
      try {
        const healthRes = await fetch("/api/platform/health", {
          cache: "no-store",
        })
        const health = await healthRes.json()
        if (!health.ok) {
          router.replace("/setup")
          return
        }

        const activeRes = await fetch("/api/platform/projects/active", {
          cache: "no-store",
        })
        const active = await activeRes.json()
        router.replace(
          active.project
            ? projectOverviewPath(active.project.id)
            : "/projects"
        )
      } catch {
        router.replace("/setup")
      }
    })()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}
