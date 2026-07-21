"use client"

import { useCallback, useState, type ReactNode } from "react"
import { StudioSidebar } from "@/components/studio/sidebar"
import { StudioTopbar } from "@/components/studio/topbar"
import {
  GlobalSearch,
  useGlobalSearchHotkey,
} from "@/components/studio/global-search"
import {
  KeyboardShortcutsDialog,
  useKeyboardShortcutsHotkey,
} from "@/components/studio/keyboard-shortcuts"
import type { SavedConnection } from "@/lib/connection"
import { useOptionalProject } from "@/lib/platform/project-context"
import { cn } from "@/lib/utils"

type StudioShellProps = {
  connection: SavedConnection
  title: string
  subtitle?: string
  onRefresh?: () => void
  refreshing?: boolean
  toolbar?: ReactNode
  /** `flush` — full-bleed editors (SQL, table data); `default` — card panel */
  contentVariant?: "default" | "flush"
  children: ReactNode
}

export function StudioShell({
  connection,
  title,
  subtitle,
  onRefresh,
  refreshing,
  toolbar,
  contentVariant = "default",
  children,
}: StudioShellProps) {
  const projectCtx = useOptionalProject()
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  useGlobalSearchHotkey(openSearch)
  useKeyboardShortcutsHotkey(openShortcuts)

  const flush = contentVariant === "flush"

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <StudioSidebar
        projectName={connection.name || "Postgres"}
        onOpenSearch={projectCtx ? openSearch : undefined}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <StudioTopbar
          title={title}
          subtitle={subtitle}
          connection={connection}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onOpenShortcuts={projectCtx ? openShortcuts : undefined}
        />
        {toolbar ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/20 px-4 py-2">
            {toolbar}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto bg-background">
          <div
            className={cn(
              flush
                ? "h-full min-h-0"
                : "m-3 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm"
            )}
          >
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
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  )
}
