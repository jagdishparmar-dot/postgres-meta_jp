"use client"

import { useMemo, useState } from "react"
import { Layers, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell } from "@/components/studio/cells"
import { SchemaEditorDialog } from "@/components/studio/schema-editor-dialog"
import { Button } from "@/components/ui/button"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { dropSchema } from "@/lib/schema-ddl"
import type { PostgresSchema } from "@/lib/types"

export function SchemasPageClient() {
  const { connection, ready } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PostgresSchema | null>(null)

  const path = connection
    ? `schemas?include_system_schemas=${includeSystem}`
    : null
  const { data, loading, refresh } = useMetaList<PostgresSchema>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresSchema>[]>(
    () => [
      {
        key: "name",
        header: "Schema",
        cell: (row) => (
          <NameCell
            name={row.name}
            icon={<Layers className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "owner",
        header: "Owner",
        cell: (row) => (
          <span className="text-muted-foreground">{row.owner}</span>
        ),
      },
      {
        key: "id",
        header: "OID",
        className: "text-right",
        cell: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.id}
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
              title="Edit schema"
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
              title="Drop schema"
              onClick={(e) => {
                e.stopPropagation()
                if (!connection) return
                void (async () => {
                  if (
                    !confirm(
                      `Drop schema "${row.name}" with CASCADE? This cannot be undone.`
                    )
                  ) {
                    return
                  }
                  try {
                    await dropSchema(row.id, connection, true)
                    toast.success(`Dropped schema ${row.name}`)
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
        title="Schemas"
        subtitle="Create, rename, and drop schemas"
        refreshing={loading}
        onRefresh={refresh}
        toolbar={
          <>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${data.length} schema${data.length === 1 ? "" : "s"}`}
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
                New schema
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
          emptyTitle="No schemas found"
          emptyDescription="Create a schema to organize objects."
          searchPlaceholder="Filter schemas…"
          onRowClick={(row) => setEditing(row)}
        />
      </StudioShell>

      <SchemaEditorDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        connection={connection}
        schema={editing}
        onSaved={() => refresh()}
      />
    </>
  )
}
