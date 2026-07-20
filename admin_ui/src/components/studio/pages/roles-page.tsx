"use client"

import { Users } from "lucide-react"
import { ResourcePage } from "@/components/studio/resource-page"
import { NameCell, BoolBadge } from "@/components/studio/cells"
import type { ColumnDef } from "@/components/studio/data-browser"
import type { PostgresRole } from "@/lib/types"

const columns: ColumnDef<PostgresRole>[] = [
  {
    key: "name",
    header: "Role",
    cell: (row) => (
      <NameCell
        name={row.name}
        icon={<Users className="size-3.5 text-primary" />}
      />
    ),
  },
  {
    key: "login",
    header: "Login",
    cell: (row) => <BoolBadge value={row.can_login} />,
  },
  {
    key: "superuser",
    header: "Superuser",
    cell: (row) => <BoolBadge value={row.is_superuser} />,
  },
  {
    key: "createdb",
    header: "Create DB",
    cell: (row) => <BoolBadge value={row.can_create_db} />,
  },
  {
    key: "bypass",
    header: "Bypass RLS",
    cell: (row) => <BoolBadge value={row.can_bypass_rls} />,
  },
  {
    key: "connections",
    header: "Connections",
    className: "text-right",
    cell: (row) => (
      <span className="font-mono text-xs">
        {row.active_connections}
        {row.connection_limit >= 0 ? ` / ${row.connection_limit}` : ""}
      </span>
    ),
  },
]

export function RolesPageClient() {
  return (
    <ResourcePage<PostgresRole>
      title="Roles"
      subtitle="Database roles and privileges"
      path={() => "roles"}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyTitle="No roles found"
      searchPlaceholder="Filter roles…"
      showSystemToggle={false}
    />
  )
}
