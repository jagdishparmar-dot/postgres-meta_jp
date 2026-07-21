"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Shield, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell, SchemaBadge } from "@/components/studio/cells"
import { PolicyEditorDialog } from "@/components/studio/policy-editor-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { dropPolicy } from "@/lib/security-ddl"
import type { PostgresPolicy } from "@/lib/types"

export function PoliciesPageClient() {
  const { connection } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PostgresPolicy | null>(null)

  const path = connection
    ? `policies?include_system_schemas=${includeSystem}`
    : null
  const { data, loading, refresh } = useMetaList<PostgresPolicy>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresPolicy>[]>(
    () => [
      {
        key: "name",
        header: "Policy",
        cell: (row) => (
          <NameCell
            schema={row.schema}
            name={row.name}
            icon={<Shield className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "table",
        header: "Table",
        cell: (row) => (
          <span className="font-mono text-xs">
            {row.schema}.{row.table}
          </span>
        ),
      },
      {
        key: "schema",
        header: "Schema",
        cell: (row) => <SchemaBadge schema={row.schema} />,
      },
      {
        key: "command",
        header: "Command",
        cell: (row) => (
          <Badge variant="secondary" className="text-[11px] font-normal">
            {row.command}
          </Badge>
        ),
      },
      {
        key: "action",
        header: "Type",
        cell: (row) => (
          <span className="text-xs text-muted-foreground">{row.action}</span>
        ),
      },
      {
        key: "roles",
        header: "Roles",
        cell: (row) => (
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {row.roles?.join(", ") || "—"}
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
              title="Edit policy"
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
              title="Drop policy"
              onClick={(e) => {
                e.stopPropagation()
                if (!connection) return
                void (async () => {
                  if (
                    !confirm(
                      `Drop policy "${row.name}" on ${row.schema}.${row.table}?`
                    )
                  ) {
                    return
                  }
                  try {
                    await dropPolicy(row.id, connection)
                    toast.success(`Dropped policy ${row.name}`)
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
    title: "Policies",
    subtitle: "Create and manage row-level security policies",
    refreshing: loading,
    onRefresh: refresh,
    toolbar: (
      <>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${data.length} polic${data.length === 1 ? "y" : "ies"}`}
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
            New policy
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
          emptyTitle="No policies found"
          emptyDescription="Create a policy to control row access."
          searchPlaceholder="Filter policies…"
          onRowClick={(row) => setEditing(row)}
        />

      <PolicyEditorDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        connection={connection}
        policy={editing}
        onSaved={() => refresh()}
      />
    </>
  )
}
