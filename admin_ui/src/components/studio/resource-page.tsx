"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import type { SavedConnection } from "@/lib/connection"

export type ResourceToolbarCtx<T> = {
  includeSystem: boolean
  setIncludeSystem: (v: boolean) => void
  count: number
  loading: boolean
  refresh: () => void
  connection: SavedConnection
  data: T[]
}

type ResourcePageProps<T> = {
  title: string
  subtitle: string
  path: (opts: { includeSystem: boolean }) => string
  columns: ColumnDef<T>[]
  getRowKey: (row: T) => string | number
  emptyTitle: string
  emptyDescription?: string
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  showSystemToggle?: boolean
  extraToolbar?: (ctx: ResourceToolbarCtx<T>) => ReactNode
  detail?: ReactNode | ((ctx: ResourceToolbarCtx<T>) => ReactNode)
}

export function ResourcePage<T>({
  title,
  subtitle,
  path,
  columns,
  getRowKey,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  onRowClick,
  showSystemToggle = true,
  extraToolbar,
  detail,
}: ResourcePageProps<T>) {
  const { connection } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const metaPath = connection ? path({ includeSystem }) : null
  const { data, loading, refresh } = useMetaList<T>(metaPath, connection, [
    includeSystem,
  ])


  const ctx: ResourceToolbarCtx<T> = {
    includeSystem,
    setIncludeSystem,
    count: data.length,
    loading,
    refresh,
    connection: connection!,
    data,
  }

  useStudioPage({
    title,
    subtitle,
    refreshing: loading,
    onRefresh: refresh,
    toolbar: (
      <>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${data.length} item${data.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          {extraToolbar?.(ctx)}
          {showSystemToggle ? (
            <Button
              variant={includeSystem ? "default" : "outline"}
              size="sm"
              onClick={() => setIncludeSystem((v) => !v)}
            >
              {includeSystem ? "Hide system schemas" : "Show system schemas"}
            </Button>
          ) : null}
        </div>
      </>
    ),
  })

  return (
    <>
      <DataBrowser
        rows={data}
        columns={columns}
        loading={loading}
        getRowKey={getRowKey}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        searchPlaceholder={searchPlaceholder}
        onRowClick={onRowClick}
      />
      {typeof detail === "function" ? detail(ctx) : detail}
    </>
  )
}
