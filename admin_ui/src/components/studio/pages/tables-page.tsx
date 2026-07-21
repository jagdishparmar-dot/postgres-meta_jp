"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Table2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell, BoolBadge, SchemaBadge } from "@/components/studio/cells"
import { CreateTableDialog } from "@/components/studio/create-table-dialog"
import { Button } from "@/components/ui/button"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { useProject } from "@/lib/platform/project-context"
import { studioPath } from "@/lib/platform/paths"
import { dropTable } from "@/lib/schema-ddl"
import type { PostgresTable } from "@/lib/types"

export function TablesPageClient() {
  const router = useRouter()
  const { projectId } = useProject()
  const { connection } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const path = connection
    ? `tables?include_system_schemas=${includeSystem}&include_columns=true`
    : null
  const { data, loading, refresh } = useMetaList<PostgresTable>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresTable>[]>(
    () => [
      {
        key: "name",
        header: "Table",
        cell: (row) => (
          <NameCell
            schema={row.schema}
            name={row.name}
            icon={<Table2 className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "schema",
        header: "Schema",
        cell: (row) => <SchemaBadge schema={row.schema} />,
      },
      {
        key: "rows",
        header: "Rows",
        className: "text-right",
        cell: (row) => (
          <span className="font-mono text-xs">
            {row.live_rows_estimate.toLocaleString()}
          </span>
        ),
      },
      {
        key: "size",
        header: "Size",
        cell: (row) => (
          <span className="text-muted-foreground">{row.size}</span>
        ),
      },
      {
        key: "rls",
        header: "RLS",
        cell: (row) => (
          <BoolBadge value={row.rls_enabled} trueLabel="On" falseLabel="Off" />
        ),
      },
      {
        key: "actions",
        header: "",
        searchable: false,
        className: "w-12",
        cell: (row) => (
          <Button
            size="icon-xs"
            variant="ghost"
            title="Drop table"
            onClick={(e) => {
              e.stopPropagation()
              if (!connection) return
              void (async () => {
                if (
                  !confirm(
                    `Drop table ${row.schema}.${row.name}? This uses CASCADE and cannot be undone.`
                  )
                ) {
                  return
                }
                try {
                  await dropTable(row.id, connection, true)
                  toast.success(`Dropped ${row.schema}.${row.name}`)
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
        ),
      },
    ],
    [connection, refresh]
  )


  useStudioPage({
    title: "Tables",
    subtitle: "Create tables or open one to edit data and columns",
    refreshing: loading,
    onRefresh: refresh,
    toolbar: (
      <>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${data.length} table${data.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New table
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
          emptyTitle="No tables found"
          emptyDescription="Create a table to get started."
          searchPlaceholder="Filter tables…"
          onRowClick={(row) =>
            router.push(
              studioPath(
                projectId,
                `/tables/${encodeURIComponent(row.schema)}/${encodeURIComponent(row.name)}`
              )
            )
          }
        />

      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        connection={connection}
        onCreated={(table) => {
          refresh()
          router.push(
            studioPath(
              projectId,
              `/tables/${encodeURIComponent(table.schema)}/${encodeURIComponent(table.name)}`
            )
          )
        }}
      />
    </>
  )
}
