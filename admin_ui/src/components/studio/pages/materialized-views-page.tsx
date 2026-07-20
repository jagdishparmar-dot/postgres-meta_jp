"use client"

import { Boxes } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, BoolBadge, SchemaBadge } from "@/components/studio/cells"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresMaterializedView } from "@/lib/types"

const columns: ColumnDef<PostgresMaterializedView>[] = [
  {
    key: "name",
    header: "Materialized view",
    cell: (row) => (
      <NameCell
        schema={row.schema}
        name={row.name}
        icon={<Boxes className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "schema",
    header: "Schema",
    cell: (row) => <SchemaBadge schema={row.schema} />,
  },
  {
    key: "populated",
    header: "Populated",
    cell: (row) => <BoolBadge value={row.is_populated} />,
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
]

export function MaterializedViewsPageClient() {
  return (
    <ResourcePage<PostgresMaterializedView>
      title="Materialized views"
      subtitle="List materialized views"
      path={({ includeSystem }) =>
        `materialized-views?include_system_schemas=${includeSystem}&include_columns=true`
      }
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No materialized views found"
      searchPlaceholder="Filter materialized views…"
    />
  )
}
