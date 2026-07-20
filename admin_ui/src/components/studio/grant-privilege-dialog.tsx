"use client"

import { useEffect, useMemo, useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DbConnectionConfig } from "@/lib/connection"
import {
  grantTablePrivileges,
  listRoles,
  listTables,
  TABLE_PRIVILEGE_TYPES,
} from "@/lib/security-ddl"
import type {
  PostgresRole,
  PostgresTable,
  PostgresTablePrivileges,
  TablePrivilegeType,
} from "@/lib/types"

type GrantPrivilegeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  relations: PostgresTablePrivileges[]
  presetRelationId?: number | null
  onGranted: () => void
}

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

const DEFAULT_PRIVS: (TablePrivilegeType | "ALL")[] = ["SELECT"]

export function GrantPrivilegeDialog({
  open,
  onOpenChange,
  connection,
  relations,
  presetRelationId,
  onGranted,
}: GrantPrivilegeDialogProps) {
  const [tables, setTables] = useState<PostgresTable[]>([])
  const [roles, setRoles] = useState<PostgresRole[]>([])
  const [relationId, setRelationId] = useState<number | "">("")
  const [grantee, setGrantee] = useState("")
  const [customGrantee, setCustomGrantee] = useState("")
  const [privs, setPrivs] = useState<(TablePrivilegeType | "ALL")[]>(DEFAULT_PRIVS)
  const [isGrantable, setIsGrantable] = useState(false)
  const [saving, setSaving] = useState(false)

  const relationOptions = useMemo(() => {
    if (relations.length) {
      return [...relations].sort((a, b) =>
        `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`)
      )
    }
    return tables.map((t) => ({
      relation_id: t.id,
      schema: t.schema,
      name: t.name,
      kind: "table" as const,
      privileges: [],
    }))
  }, [relations, tables])

  useEffect(() => {
    if (!open) return
    void Promise.all([listTables(connection), listRoles(connection)])
      .then(([tableList, roleList]) => {
        setTables(tableList)
        setRoles(roleList.filter((r) => !r.name.startsWith("pg_")))
      })
      .catch(() => {
        setTables([])
        setRoles([])
      })

    setPrivs(DEFAULT_PRIVS)
    setIsGrantable(false)
    setCustomGrantee("")
    setGrantee("public")
    if (presetRelationId) {
      setRelationId(presetRelationId)
    } else {
      setRelationId("")
    }
  }, [open, connection, presetRelationId])

  useEffect(() => {
    if (!open || relationId !== "" || !relationOptions.length) return
    setRelationId(relationOptions[0].relation_id)
  }, [open, relationId, relationOptions])

  function togglePriv(p: TablePrivilegeType | "ALL") {
    setPrivs((prev) => {
      if (p === "ALL") return prev.includes("ALL") ? [] : ["ALL"]
      const withoutAll = prev.filter((x) => x !== "ALL")
      return withoutAll.includes(p)
        ? withoutAll.filter((x) => x !== p)
        : [...withoutAll, p]
    })
  }

  async function onSubmit() {
    const role = (customGrantee.trim() || grantee).trim()
    if (!relationId) {
      toast.error("Select a table")
      return
    }
    if (!role) {
      toast.error("Grantee is required")
      return
    }
    if (!privs.length) {
      toast.error("Select at least one privilege")
      return
    }

    setSaving(true)
    try {
      await grantTablePrivileges(
        privs.map((privilege_type) => ({
          relation_id: Number(relationId),
          grantee: role,
          privilege_type,
          is_grantable: isGrantable,
        })),
        connection
      )
      toast.success(`Granted ${privs.join(", ")} to ${role}`)
      onGranted()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant privileges</DialogTitle>
          <DialogDescription>
            GRANT privileges on a table (or view) to a role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="grant-relation">Relation</Label>
            <select
              id="grant-relation"
              className={selectClass}
              value={relationId === "" ? "" : String(relationId)}
              onChange={(e) =>
                setRelationId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {relationOptions.map((r) => (
                <option key={r.relation_id} value={r.relation_id}>
                  {r.schema}.{r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-role">Role</Label>
            <select
              id="grant-role"
              className={selectClass}
              value={grantee}
              onChange={(e) => {
                setGrantee(e.target.value)
                setCustomGrantee("")
              }}
            >
              <option value="public">public</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <Input
              className="mt-1.5"
              placeholder="Or type a role name…"
              value={customGrantee}
              onChange={(e) => setCustomGrantee(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Privileges</Label>
            <div className="flex flex-wrap gap-2">
              {TABLE_PRIVILEGE_TYPES.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                >
                  <Checkbox
                    checked={privs.includes(p)}
                    onCheckedChange={() => togglePriv(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={isGrantable}
              onCheckedChange={(v) => setIsGrantable(v === true)}
            />
            WITH GRANT OPTION
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            <KeyRound className="size-3.5" />
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
