"use client"

import { Type } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, SchemaBadge } from "@/components/studio/cells"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresType } from "@/lib/types"

const columns: ColumnDef<PostgresType>[] = [
  {
    key: "name",
    header: "Type",
    cell: (row) => (
      <NameCell
        schema={row.schema}
        name={row.name}
        icon={<Type className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "schema",
    header: "Schema",
    cell: (row) => <SchemaBadge schema={row.schema} />,
  },
  {
    key: "format",
    header: "Format",
    cell: (row) => (
      <Badge variant="outline" className="font-mono text-[11px] font-normal">
        {row.format}
      </Badge>
    ),
  },
  {
    key: "enums",
    header: "Enums",
    cell: (row) => (
      <span className="line-clamp-1 font-mono text-xs text-muted-foreground">
        {row.enums?.length ? row.enums.join(", ") : "—"}
      </span>
    ),
  },
]

export function TypesPageClient() {
  return (
    <ResourcePage<PostgresType>
      title="Types"
      subtitle="Custom and enum types"
      path={({ includeSystem }) =>
        `types?include_system_schemas=${includeSystem}`
      }
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No types found"
      searchPlaceholder="Filter types…"
    />
  )
}
