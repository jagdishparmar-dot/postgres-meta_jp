"use client"

import { useMemo, useState } from "react"
import { Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell, BoolBadge, SchemaBadge } from "@/components/studio/cells"
import { ViewEditorDialog } from "@/components/studio/view-editor-dialog"
import { Button } from "@/components/ui/button"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { dropView } from "@/lib/schema-ddl"
import type { PostgresView } from "@/lib/types"

export function ViewsPageClient() {
  const { connection, ready } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PostgresView | null>(null)

  const path = connection
    ? `views?include_system_schemas=${includeSystem}&include_columns=true`
    : null
  const { data, loading, refresh } = useMetaList<PostgresView>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresView>[]>(
    () => [
      {
        key: "name",
        header: "View",
        cell: (row) => (
          <NameCell
            schema={row.schema}
            name={row.name}
            icon={<Eye className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "schema",
        header: "Schema",
        cell: (row) => <SchemaBadge schema={row.schema} />,
      },
      {
        key: "updatable",
        header: "Updatable",
        cell: (row) => <BoolBadge value={row.is_updatable} />,
      },
      {
        key: "columns",
        header: "Columns",
        className: "text-right",
        cell: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.columns?.length ?? "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        searchable: false,
        className: "w-20",
        cell: (row) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button
              size="icon-xs"
              variant="ghost"
              title="Edit view"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(row)
              }}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              title="Drop view"
              onClick={(e) => {
                e.stopPropagation()
                if (!connection) return
                void (async () => {
                  if (
                    !confirm(
                      `Drop view ${row.schema}.${row.name}? (CASCADE)`
                    )
                  ) {
                    return
                  }
                  try {
                    await dropView(row.schema, row.name, connection, true)
                    toast.success(`Dropped view ${row.name}`)
                    if (editing?.id === row.id) setEditing(null)
                    refresh()
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Drop failed"
                    )
                  }
                })()
              }}
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [connection, refresh, editing]
  )

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading connection…
      </div>
    )
  }

  return (
    <>
      <StudioShell
        connection={connection}
        title="Views"
        subtitle="Create and edit views with CREATE OR REPLACE VIEW"
        refreshing={loading}
        onRefresh={refresh}
        toolbar={
          <>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${data.length} view${data.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setCreateOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                New view
              </Button>
              <Button
                variant={includeSystem ? "default" : "outline"}
                size="sm"
                onClick={() => setIncludeSystem((v) => !v)}
              >
                {includeSystem ? "Hide system schemas" : "Show system schemas"}
              </Button>
            </div>
          </>
        }
      >
        <DataBrowser
          rows={data}
          columns={columns}
          loading={loading}
          getRowKey={(row) => row.id}
          emptyTitle="No views found"
          emptyDescription="Create a view from a SELECT query."
          searchPlaceholder="Filter views…"
          onRowClick={(row) => setEditing(row)}
        />
      </StudioShell>

      <ViewEditorDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        connection={connection}
        view={editing}
        onSaved={() => refresh()}
      />
    </>
  )
}
