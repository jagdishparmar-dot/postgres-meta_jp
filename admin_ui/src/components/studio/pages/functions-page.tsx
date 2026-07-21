"use client"

import { useMemo, useState } from "react"
import { FunctionSquare, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell, BoolBadge, SchemaBadge } from "@/components/studio/cells"
import { FunctionEditorDialog } from "@/components/studio/function-editor-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { dropFunction } from "@/lib/schema-ddl"
import type { PostgresFunction } from "@/lib/types"

export function FunctionsPageClient() {
  const { connection } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PostgresFunction | null>(null)

  const path = connection
    ? `functions?include_system_schemas=${includeSystem}`
    : null
  const { data, loading, refresh } = useMetaList<PostgresFunction>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresFunction>[]>(
    () => [
      {
        key: "name",
        header: "Function",
        cell: (row) => (
          <NameCell
            schema={row.schema}
            name={row.name}
            icon={<FunctionSquare className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "schema",
        header: "Schema",
        cell: (row) => <SchemaBadge schema={row.schema} />,
      },
      {
        key: "language",
        header: "Language",
        cell: (row) => (
          <Badge variant="outline" className="font-mono text-[11px] font-normal">
            {row.language}
          </Badge>
        ),
      },
      {
        key: "args",
        header: "Arguments",
        cell: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.argument_types || "—"}
          </span>
        ),
      },
      {
        key: "return",
        header: "Returns",
        cell: (row) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.return_type}
          </span>
        ),
      },
      {
        key: "security",
        header: "Security definer",
        cell: (row) => <BoolBadge value={row.security_definer} />,
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
              title="Edit function"
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
              title="Drop function"
              onClick={(e) => {
                e.stopPropagation()
                if (!connection) return
                void (async () => {
                  if (
                    !confirm(
                      `Drop function ${row.schema}.${row.name}(${row.argument_types || ""})?`
                    )
                  ) {
                    return
                  }
                  try {
                    await dropFunction(row.id, connection, true)
                    toast.success(`Dropped function ${row.name}`)
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


  useStudioPage({
    title: "Functions",
    subtitle: "Create, edit, and drop database functions",
    refreshing: loading,
    onRefresh: refresh,
    toolbar: (
      <>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${data.length} function${data.length === 1 ? "" : "s"}`}
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
            New function
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
    ),
  })

  if (!connection) return null

  return (
    <>
        <DataBrowser
          rows={data}
          columns={columns}
          loading={loading}
          getRowKey={(row) => row.id}
          emptyTitle="No functions found"
          emptyDescription="Create a function to get started."
          searchPlaceholder="Filter functions…"
          onRowClick={(row) => setEditing(row)}
        />

      <FunctionEditorDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        connection={connection}
        fn={editing}
        onSaved={() => refresh()}
      />
    </>
  )
}
