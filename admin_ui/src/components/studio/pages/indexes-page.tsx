"use client"

import { ListTree } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, BoolBadge, SchemaBadge } from "@/components/studio/cells"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresIndex } from "@/lib/types"

function indexName(row: PostgresIndex) {
  const match = row.index_definition.match(/INDEX\s+(?:CONCURRENTLY\s+)?(?:IF NOT EXISTS\s+)?(?:"?[\w.]+"?\.)?"?([\w]+)"?/i)
  return match?.[1] || `index_${row.id}`
}

const columns: ColumnDef<PostgresIndex>[] = [
  {
    key: "name",
    header: "Index",
    cell: (row) => (
      <NameCell
        schema={row.schema}
        name={indexName(row)}
        icon={<ListTree className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "schema",
    header: "Schema",
    cell: (row) => <SchemaBadge schema={row.schema} />,
  },
  {
    key: "method",
    header: "Method",
    cell: (row) => (
      <Badge variant="outline" className="font-mono text-[11px] font-normal">
        {row.access_method}
      </Badge>
    ),
  },
  {
    key: "unique",
    header: "Unique",
    cell: (row) => <BoolBadge value={row.is_unique} />,
  },
  {
    key: "primary",
    header: "Primary",
    cell: (row) => <BoolBadge value={row.is_primary} />,
  },
  {
    key: "attrs",
    header: "Columns",
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.index_attributes?.map((a) => a.attribute_name).join(", ") || "—"}
      </span>
    ),
  },
]

export function IndexesPageClient() {
  return (
    <ResourcePage<PostgresIndex>
      title="Indexes"
      subtitle="Indexes across tables"
      path={({ includeSystem }) =>
        `indexes?include_system_schemas=${includeSystem}`
      }
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No indexes found"
      searchPlaceholder="Filter indexes…"
    />
  )
}
