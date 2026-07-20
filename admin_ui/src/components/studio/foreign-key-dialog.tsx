"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
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
import { addForeignKey } from "@/lib/schema-ddl"
import { fetchMeta } from "@/lib/client-meta"
import type { PostgresTable } from "@/lib/types"

const FK_ACTIONS = [
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
] as const

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

type ForeignKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  table: PostgresTable
  onSaved: () => void
}

export function ForeignKeyDialog({
  open,
  onOpenChange,
  connection,
  table,
  onSaved,
}: ForeignKeyDialogProps) {
  const localColumns = useMemo(
    () =>
      [...(table.columns || [])].sort(
        (a, b) => a.ordinal_position - b.ordinal_position
      ),
    [table.columns]
  )

  const [tables, setTables] = useState<PostgresTable[]>([])
  const [name, setName] = useState("")
  const [columns, setColumns] = useState<string[]>([])
  const [refSchema, setRefSchema] = useState("public")
  const [refTable, setRefTable] = useState("")
  const [refColumns, setRefColumns] = useState<string[]>([])
  const [onDelete, setOnDelete] =
    useState<(typeof FK_ACTIONS)[number]>("NO ACTION")
  const [onUpdate, setOnUpdate] =
    useState<(typeof FK_ACTIONS)[number]>("NO ACTION")
  const [saving, setSaving] = useState(false)

  const schemas = useMemo(
    () => [...new Set(tables.map((t) => t.schema))].sort(),
    [tables]
  )
  const tablesInSchema = useMemo(
    () =>
      tables
        .filter((t) => t.schema === refSchema)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tables, refSchema]
  )
  const refTableMeta = tablesInSchema.find((t) => t.name === refTable)
  const refCols = [...(refTableMeta?.columns || [])].sort(
    (a, b) => a.ordinal_position - b.ordinal_position
  )

  useEffect(() => {
    if (!open) return
    void fetchMeta<PostgresTable[]>(
      "tables?include_system_schemas=false&include_columns=true",
      connection
    )
      .then(setTables)
      .catch(() => setTables([]))
    setName("")
    setColumns([])
    setRefColumns([])
    setOnDelete("NO ACTION")
    setOnUpdate("NO ACTION")
    setRefSchema(table.schema === "public" ? "public" : table.schema)
  }, [open, connection, table.schema])

  useEffect(() => {
    if (!open || !tablesInSchema.length) return
    if (!tablesInSchema.some((t) => t.name === refTable)) {
      const first = tablesInSchema.find(
        (t) => !(t.schema === table.schema && t.name === table.name)
      )
      setRefTable(first?.name || tablesInSchema[0].name)
    }
  }, [open, tablesInSchema, refTable, table.schema, table.name])

  function toggleLocal(col: string) {
    setColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  function toggleRef(col: string) {
    setRefColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  async function onSubmit() {
    if (!columns.length || !refColumns.length) {
      toast.error("Select source and referenced columns")
      return
    }
    if (columns.length !== refColumns.length) {
      toast.error("Source and referenced column counts must match")
      return
    }
    setSaving(true)
    try {
      await addForeignKey(
        table,
        {
          name: name.trim() || undefined,
          columns,
          referencedSchema: refSchema,
          referencedTable: refTable,
          referencedColumns: refColumns,
          onDelete,
          onUpdate,
        },
        connection
      )
      toast.success("Foreign key added")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add FK")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add foreign key</DialogTitle>
          <DialogDescription>
            References another table from{" "}
            <span className="font-mono">
              {table.schema}.{table.name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fk-name">Constraint name (optional)</Label>
            <Input
              id="fk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="auto-generated if empty"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Columns</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {localColumns.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-1 py-0.5 text-xs"
                >
                  <Checkbox
                    checked={columns.includes(c.name)}
                    onCheckedChange={() => toggleLocal(c.name)}
                  />
                  <span className="font-mono">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Referenced schema</Label>
              <select
                className={selectClass}
                value={refSchema}
                onChange={(e) => setRefSchema(e.target.value)}
              >
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Referenced table</Label>
              <select
                className={selectClass}
                value={refTable}
                onChange={(e) => {
                  setRefTable(e.target.value)
                  setRefColumns([])
                }}
              >
                {tablesInSchema.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referenced columns</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {refCols.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-1 py-0.5 text-xs"
                >
                  <Checkbox
                    checked={refColumns.includes(c.name)}
                    onCheckedChange={() => toggleRef(c.name)}
                  />
                  <span className="font-mono">{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ON DELETE</Label>
              <select
                className={selectClass}
                value={onDelete}
                onChange={(e) =>
                  setOnDelete(e.target.value as (typeof FK_ACTIONS)[number])
                }
              >
                {FK_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>ON UPDATE</Label>
              <select
                className={selectClass}
                value={onUpdate}
                onChange={(e) =>
                  setOnUpdate(e.target.value as (typeof FK_ACTIONS)[number])
                }
              >
                {FK_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Add foreign key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
