"use client"

import { useRouter } from "next/navigation"
import { FolderKanban, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SavedConnection } from "@/lib/connection"

type StudioTopbarProps = {
  title: string
  subtitle?: string
  connection: SavedConnection | null
  onRefresh?: () => void
  refreshing?: boolean
}

export function StudioTopbar({
  title,
  subtitle,
  connection,
  onRefresh,
  refreshing,
}: StudioTopbarProps) {
  const router = useRouter()

  async function backToProjects() {
    await fetch("/api/platform/projects/active", { method: "DELETE" })
    router.push("/projects")
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4">
      <div className="flex min-w-0 items-center gap-2">
        {connection ? (
          <>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {connection.name}
            </span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
          </>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium leading-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {connection ? (
          <Badge
            variant="outline"
            className="hidden max-w-[220px] truncate font-normal md:inline-flex"
          >
            {connection.database}
          </Badge>
        ) : null}

        {onRefresh ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void backToProjects()}>
          <FolderKanban className="size-3.5" />
          Projects
        </Button>
      </div>
    </header>
  )
}
