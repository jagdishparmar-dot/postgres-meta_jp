"use client"

import { Puzzle } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, BoolBadge } from "@/components/studio/cells"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresExtension } from "@/lib/types"

const columns: ColumnDef<PostgresExtension>[] = [
  {
    key: "name",
    header: "Extension",
    cell: (row) => (
      <NameCell
        name={row.name}
        icon={<Puzzle className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "installed",
    header: "Installed",
    cell: (row) => (
      <BoolBadge
        value={!!row.installed_version}
        trueLabel={row.installed_version || "Yes"}
        falseLabel="No"
      />
    ),
  },
  {
    key: "default",
    header: "Default version",
    cell: (row) => (
      <Badge variant="outline" className="font-mono text-[11px] font-normal">
        {row.default_version}
      </Badge>
    ),
  },
  {
    key: "schema",
    header: "Schema",
    cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.schema || "—"}
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

export function ExtensionsPageClient() {
  return (
    <ResourcePage<PostgresExtension>
      title="Extensions"
      subtitle="Available and installed Postgres extensions"
      path={() => "extensions"}
      columns={columns}
      getRowKey={(row) => row.name}
      emptyTitle="No extensions found"
      searchPlaceholder="Filter extensions…"
      showSystemToggle={false}
    />
  )
}
