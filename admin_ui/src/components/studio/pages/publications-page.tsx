"use client"

import { Megaphone } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, BoolBadge } from "@/components/studio/cells"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresPublication } from "@/lib/types"

const columns: ColumnDef<PostgresPublication>[] = [
  {
    key: "name",
    header: "Publication",
    cell: (row) => (
      <NameCell
        name={row.name}
        icon={<Megaphone className="size-3.5 text-primary" />}
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
    key: "insert",
    header: "Insert",
    cell: (row) => <BoolBadge value={row.publish_insert} />,
  },
  {
    key: "update",
    header: "Update",
    cell: (row) => <BoolBadge value={row.publish_update} />,
  },
  {
    key: "delete",
    header: "Delete",
    cell: (row) => <BoolBadge value={row.publish_delete} />,
  },
  {
    key: "truncate",
    header: "Truncate",
    cell: (row) => <BoolBadge value={row.publish_truncate} />,
  },
]

export function PublicationsPageClient() {
  return (
    <ResourcePage<PostgresPublication>
      title="Publications"
      subtitle="Logical replication publications"
      path={() => "publications"}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No publications found"
      searchPlaceholder="Filter publications…"
      showSystemToggle={false}
    />
  )
}
