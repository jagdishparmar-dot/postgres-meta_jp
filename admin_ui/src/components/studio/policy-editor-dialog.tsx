"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  createPolicy,
  listTables,
  POLICY_ACTIONS,
  POLICY_COMMANDS,
  parseRolesInput,
  updatePolicy,
} from "@/lib/security-ddl"
import type { PostgresPolicy, PostgresTable } from "@/lib/types"

type PolicyEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  policy?: PostgresPolicy | null
  onSaved: (policy: PostgresPolicy) => void
}

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

export function PolicyEditorDialog({
  open,
  onOpenChange,
  connection,
  policy,
  onSaved,
}: PolicyEditorDialogProps) {
  const isEdit = Boolean(policy)
  const [tables, setTables] = useState<PostgresTable[]>([])
  const [name, setName] = useState("")
  const [schema, setSchema] = useState("public")
  const [table, setTable] = useState("")
  const [action, setAction] =
    useState<(typeof POLICY_ACTIONS)[number]>("PERMISSIVE")
  const [command, setCommand] =
    useState<(typeof POLICY_COMMANDS)[number]>("ALL")
  const [roles, setRoles] = useState("public")
  const [definition, setDefinition] = useState("")
  const [check, setCheck] = useState("")
  const [saving, setSaving] = useState(false)

  const schemas = useMemo(() => {
    const set = new Set(tables.map((t) => t.schema))
    return [...set].sort()
  }, [tables])

  const tablesInSchema = useMemo(
    () => tables.filter((t) => t.schema === schema).sort((a, b) => a.name.localeCompare(b.name)),
    [tables, schema]
  )

  useEffect(() => {
    if (!open) return
    void listTables(connection)
      .then((list) => {
        setTables(list)
        if (!policy && list.length) {
          const first = list.find((t) => t.schema === "public") ?? list[0]
          setSchema(first.schema)
          setTable(first.name)
        }
      })
      .catch(() => setTables([]))

    if (policy) {
      setName(policy.name)
      setSchema(policy.schema)
      setTable(policy.table)
      setAction(
        (POLICY_ACTIONS.includes(policy.action as (typeof POLICY_ACTIONS)[number])
          ? policy.action
          : "PERMISSIVE") as (typeof POLICY_ACTIONS)[number]
      )
      setCommand(
        (POLICY_COMMANDS.includes(policy.command as (typeof POLICY_COMMANDS)[number])
          ? policy.command
          : "ALL") as (typeof POLICY_COMMANDS)[number]
      )
      setRoles(policy.roles?.join(", ") || "public")
      setDefinition(policy.definition ?? "")
      setCheck(policy.check ?? "")
    } else {
      setName("")
      setAction("PERMISSIVE")
      setCommand("ALL")
      setRoles("public")
      setDefinition("true")
      setCheck("")
    }
  }, [open, connection, policy])

  useEffect(() => {
    if (isEdit || !open) return
    if (!tablesInSchema.some((t) => t.name === table) && tablesInSchema[0]) {
      setTable(tablesInSchema[0].name)
    }
  }, [schema, tablesInSchema, table, isEdit, open])

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("Policy name is required")
      return
    }
    if (!isEdit && (!schema || !table)) {
      toast.error("Select a table")
      return
    }

    const roleList = parseRolesInput(roles)
    setSaving(true)
    try {
      const saved = isEdit && policy
        ? await updatePolicy(
            policy.id,
            {
              name: name.trim(),
              roles: roleList.length ? roleList : ["public"],
              definition: definition.trim() || null,
              check: check.trim() || null,
            },
            connection
          )
        : await createPolicy(
            {
              name: name.trim(),
              schema,
              table,
              action,
              command,
              roles: roleList.length ? roleList : ["public"],
              definition: definition.trim() || undefined,
              check: check.trim() || undefined,
            },
            connection
          )
      toast.success(isEdit ? `Updated policy ${saved.name}` : `Created policy ${saved.name}`)
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit policy" : "Create policy"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename or change USING / WITH CHECK expressions and roles. Command and action cannot be changed."
              : "Creates a row-level security policy via CREATE POLICY."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="policy-name">Name</Label>
            <Input
              id="policy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="allow_select"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="policy-schema">Schema</Label>
              <select
                id="policy-schema"
                className={selectClass}
                value={schema}
                disabled={isEdit}
                onChange={(e) => setSchema(e.target.value)}
              >
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {!schemas.length ? <option value="public">public</option> : null}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy-table">Table</Label>
              <select
                id="policy-table"
                className={selectClass}
                value={table}
                disabled={isEdit}
                onChange={(e) => setTable(e.target.value)}
              >
                {tablesInSchema.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
                {!tablesInSchema.length ? (
                  <option value="">No tables</option>
                ) : null}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="policy-action">Action</Label>
              <select
                id="policy-action"
                className={selectClass}
                value={action}
                disabled={isEdit}
                onChange={(e) =>
                  setAction(e.target.value as (typeof POLICY_ACTIONS)[number])
                }
              >
                {POLICY_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy-command">Command</Label>
              <select
                id="policy-command"
                className={selectClass}
                value={command}
                disabled={isEdit}
                onChange={(e) =>
                  setCommand(e.target.value as (typeof POLICY_COMMANDS)[number])
                }
              >
                {POLICY_COMMANDS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="policy-roles">Roles (comma-separated)</Label>
            <Input
              id="policy-roles"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              placeholder="public, authenticated"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="policy-using">USING expression</Label>
            <Textarea
              id="policy-using"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="true"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="policy-check">WITH CHECK expression</Label>
            <Textarea
              id="policy-check"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
              placeholder="Optional — for INSERT / UPDATE"
              rows={3}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save policy" : "Create policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
