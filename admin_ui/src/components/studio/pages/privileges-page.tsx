"use client"

import { useMemo, useState } from "react"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { DataBrowser, type ColumnDef } from "@/components/studio/data-browser"
import { NameCell, SchemaBadge } from "@/components/studio/cells"
import { GrantPrivilegeDialog } from "@/components/studio/grant-privilege-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useMetaList } from "@/hooks/use-meta-list"
import { revokeTablePrivileges } from "@/lib/security-ddl"
import type {
  PostgresTablePrivilegeGrant,
  PostgresTablePrivileges,
} from "@/lib/types"

export function PrivilegesPageClient() {
  const { connection, ready } = useStudioConnection()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [selected, setSelected] = useState<PostgresTablePrivileges | null>(null)

  const path = connection
    ? `table-privileges?include_system_schemas=${includeSystem}`
    : null
  const { data, loading, refresh } = useMetaList<PostgresTablePrivileges>(
    path,
    connection,
    [includeSystem]
  )

  const columns = useMemo<ColumnDef<PostgresTablePrivileges>[]>(
    () => [
      {
        key: "name",
        header: "Relation",
        cell: (row) => (
          <NameCell
            schema={row.schema}
            name={row.name}
            icon={<KeyRound className="size-3.5 text-primary" />}
          />
        ),
      },
      {
        key: "schema",
        header: "Schema",
        cell: (row) => <SchemaBadge schema={row.schema} />,
      },
      {
        key: "kind",
        header: "Kind",
        cell: (row) => (
          <Badge variant="secondary" className="text-[11px] font-normal">
            {row.kind.replace("_", " ")}
          </Badge>
        ),
      },
      {
        key: "grants",
        header: "Grants",
        className: "text-right",
        cell: (row) => (
          <span className="font-mono text-xs">{row.privileges.length}</span>
        ),
      },
      {
        key: "preview",
        header: "Roles",
        cell: (row) => {
          const roles = [...new Set(row.privileges.map((p) => p.grantee))]
          return (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {roles.slice(0, 4).join(", ") || "—"}
              {roles.length > 4 ? ` +${roles.length - 4}` : ""}
            </span>
          )
        },
      },
    ],
    []
  )

  async function onRevoke(
    relation: PostgresTablePrivileges,
    grant: PostgresTablePrivilegeGrant
  ) {
    if (!connection) return
    if (
      !confirm(
        `Revoke ${grant.privilege_type} on ${relation.schema}.${relation.name} from ${grant.grantee}?`
      )
    ) {
      return
    }
    try {
      await revokeTablePrivileges(
        [
          {
            relation_id: relation.relation_id,
            grantee: grant.grantee,
            privilege_type: grant.privilege_type,
          },
        ],
        connection
      )
      toast.success(`Revoked ${grant.privilege_type} from ${grant.grantee}`)
      refresh()
      setSelected((prev) => {
        if (!prev || prev.relation_id !== relation.relation_id) return prev
        return {
          ...prev,
          privileges: prev.privileges.filter(
            (p) =>
              !(
                p.grantee === grant.grantee &&
                p.privilege_type === grant.privilege_type
              )
          ),
        }
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed")
    }
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading connection…
      </div>
    )
  }

  // Keep detail in sync after refresh
  const detail =
    selected &&
    (data.find((r) => r.relation_id === selected.relation_id) ?? selected)

  return (
    <>
      <StudioShell
        connection={connection}
        title="Table privileges"
        subtitle="Grant and revoke privileges on tables and views"
        refreshing={loading}
        onRefresh={refresh}
        toolbar={
          <>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${data.length} relation${data.length === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setGrantOpen(true)}>
                <Plus className="size-3.5" />
                Grant
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
        }
      >
        <DataBrowser
          rows={data}
          columns={columns}
          loading={loading}
          getRowKey={(row) => row.relation_id}
          emptyTitle="No privileges found"
          emptyDescription="Open a relation to manage grants."
          searchPlaceholder="Filter relations…"
          onRowClick={(row) => setSelected(row)}
        />
      </StudioShell>

      <GrantPrivilegeDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        connection={connection}
        relations={data}
        presetRelationId={detail?.relation_id}
        onGranted={() => refresh()}
      />

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {detail ? `${detail.schema}.${detail.name}` : "Privileges"}
            </DialogTitle>
            <DialogDescription>
              Existing grants on this relation. Revoke individually or grant
              more.
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setGrantOpen(true)
                  }}
                >
                  <Plus className="size-3.5" />
                  Grant
                </Button>
              </div>

              {!detail.privileges.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No privileges listed for this relation.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Grantee</th>
                        <th className="px-3 py-2 font-medium">Privilege</th>
                        <th className="px-3 py-2 font-medium">Grantable</th>
                        <th className="px-3 py-2 font-medium">Grantor</th>
                        <th className="w-10 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.privileges.map((g) => (
                        <tr
                          key={`${g.grantee}-${g.privilege_type}-${g.grantor}`}
                          className="border-t border-border"
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            {g.grantee}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="secondary"
                              className="text-[11px] font-normal"
                            >
                              {g.privilege_type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {g.is_grantable ? "Yes" : "No"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {g.grantor}
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              title="Revoke"
                              onClick={() => void onRevoke(detail, g)}
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
