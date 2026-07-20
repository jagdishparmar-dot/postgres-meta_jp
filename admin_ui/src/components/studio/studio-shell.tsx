"use client"

import { useCallback, useState, type ReactNode } from "react"
import { StudioSidebar } from "@/components/studio/sidebar"
import { StudioTopbar } from "@/components/studio/topbar"
import {
  GlobalSearch,
  useGlobalSearchHotkey,
} from "@/components/studio/global-search"
import type { SavedConnection } from "@/lib/connection"
import { useOptionalProject } from "@/lib/platform/project-context"

type StudioShellProps = {
  connection: SavedConnection
  title: string
  subtitle?: string
  onRefresh?: () => void
  refreshing?: boolean
  toolbar?: ReactNode
  children: ReactNode
}

export function StudioShell({
  connection,
  title,
  subtitle,
  onRefresh,
  refreshing,
  toolbar,
  children,
}: StudioShellProps) {
  const projectCtx = useOptionalProject()
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  useGlobalSearchHotkey(openSearch)

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <StudioSidebar
        projectName={connection.name || "Postgres"}
        onOpenSearch={projectCtx ? openSearch : undefined}
      />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <StudioTopbar
          title={title}
          subtitle={subtitle}
          connection={connection}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
        {toolbar ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
            {toolbar}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="m-3 overflow-hidden rounded-lg border border-border bg-card">
            {children}
          </div>
        </div>
      </div>
      {projectCtx ? (
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          projectId={projectCtx.projectId}
        />
      ) : null}
    </div>
  )
}
