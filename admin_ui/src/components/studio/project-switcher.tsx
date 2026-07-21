"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Check, ChevronsUpDown, FolderKanban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { PlatformProject } from "@/lib/platform/types"

export function ProjectSwitcher({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<PlatformProject[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/projects", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load projects")
      setProjects(
        (data.projects as PlatformProject[]).filter((p) => p.status === "active")
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  async function switchTo(id: string) {
    if (id === projectId) {
      setOpen(false)
      return
    }
    setSwitching(id)
    try {
      const res = await fetch(`/api/platform/projects/${id}/open`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to open project")

      const match = pathname.match(/\/projects\/[^/]+\/database(\/.*)?$/)
      const suffix = match?.[1] || "/schemas"
      router.push(`/projects/${id}/database${suffix}`)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Switch failed")
    } finally {
      setSwitching(null)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 max-w-[200px] gap-1.5 px-2 font-normal"
          />
        }
      >
        <span className="truncate text-sm font-medium">{projectName}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch project</DropdownMenuLabel>
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => void switchTo(p.id)}
              disabled={switching === p.id}
            >
              <span className="truncate">{p.name}</span>
              {p.id === projectId ? (
                <Check className="ml-auto size-3.5 text-primary" />
              ) : switching === p.id ? (
                <Loader2 className="ml-auto size-3.5 animate-spin" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false)
            router.push("/projects")
          }}
        >
          <FolderKanban className="size-3.5" />
          All projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
