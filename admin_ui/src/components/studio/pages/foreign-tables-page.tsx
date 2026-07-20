"use client"

import { TableProperties } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, SchemaBadge } from "@/components/studio/cells"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresForeignTable } from "@/lib/types"

const columns: ColumnDef<PostgresForeignTable>[] = [
  {
    key: "name",
    header: "Foreign table",
    cell: (row) => (
      <NameCell
        schema={row.schema}
        name={row.name}
        icon={<TableProperties className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "schema",
    header: "Schema",
    cell: (row) => <SchemaBadge schema={row.schema} />,
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
    key: "comment",
    header: "Comment",
    cell: (row) => (
      <span className="line-clamp-1 text-muted-foreground">
        {row.comment || "—"}
      </span>
    ),
  },
]

export function ForeignTablesPageClient() {
  return (
    <ResourcePage<PostgresForeignTable>
      title="Foreign tables"
      subtitle="List foreign tables"
      path={() => `foreign-tables?include_columns=true`}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No foreign tables found"
      searchPlaceholder="Filter foreign tables…"
      showSystemToggle={false}
    />
  )
}
