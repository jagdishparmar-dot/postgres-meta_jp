"use client"

import { Zap } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, SchemaBadge } from "@/components/studio/cells"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresTrigger } from "@/lib/types"

const columns: ColumnDef<PostgresTrigger>[] = [
  {
    key: "name",
    header: "Trigger",
    cell: (row) => (
      <NameCell
        schema={row.schema}
        name={row.name}
        icon={<Zap className="size-3.5 text-primary" />}
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
    key: "events",
    header: "Events",
    cell: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.events.map((event) => (
          <Badge
            key={event}
            variant="secondary"
            className="text-[10px] font-normal"
          >
            {event}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "activation",
    header: "When",
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.activation} · {row.orientation}
      </span>
    ),
  },
  {
    key: "enabled",
    header: "Mode",
    cell: (row) => (
      <Badge variant="outline" className="text-[11px] font-normal">
        {row.enabled_mode}
      </Badge>
    ),
  },
]

export function TriggersPageClient() {
  return (
    <ResourcePage<PostgresTrigger>
      title="Triggers"
      subtitle="Table triggers and their events"
      path={({ includeSystem }) =>
        `triggers?include_system_schemas=${includeSystem}`
      }
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No triggers found"
      searchPlaceholder="Filter triggers…"
    />
  )
}
