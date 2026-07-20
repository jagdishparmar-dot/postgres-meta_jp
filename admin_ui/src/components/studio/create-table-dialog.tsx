"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  COMMON_COLUMN_TYPES,
  createTableWithColumns,
  emptyColumnDraft,
  listSchemas,
  type ColumnDraft,
} from "@/lib/schema-ddl"
import type { PostgresSchema, PostgresTable } from "@/lib/types"

type CreateTableDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  onCreated: (table: PostgresTable) => void
}

export function CreateTableDialog({
  open,
  onOpenChange,
  connection,
  onCreated,
}: CreateTableDialogProps) {
  const [schemas, setSchemas] = useState<PostgresSchema[]>([])
  const [schema, setSchema] = useState("public")
  const [name, setName] = useState("")
  const [comment, setComment] = useState("")
  const [columns, setColumns] = useState<ColumnDraft[]>([
    {
      ...emptyColumnDraft(),
      name: "id",
      type: "int8",
      is_nullable: false,
      is_primary_key: true,
      is_identity: true,
    },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void listSchemas(connection)
      .then((list) => {
        setSchemas(list)
        if (list.some((s) => s.name === "public")) setSchema("public")
        else if (list[0]) setSchema(list[0].name)
      })
      .catch(() => setSchemas([]))
  }, [open, connection])

  function updateColumn(index: number, patch: Partial<ColumnDraft>) {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...patch } : col))
    )
  }

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("Table name is required")
      return
    }
    const validCols = columns.filter((c) => c.name.trim())
    if (!validCols.length) {
      toast.error("Add at least one column")
      return
    }

    setSaving(true)
    try {
      const table = await createTableWithColumns(
        {
          name: name.trim(),
          schema,
          comment: comment.trim() || undefined,
          columns: validCols,
        },
        connection
      )
      toast.success(`Created ${table.schema}.${table.name}`)
      onCreated(table)
      onOpenChange(false)
      setName("")
      setComment("")
      setColumns([
        {
          ...emptyColumnDraft(),
          name: "id",
          type: "int8",
          is_nullable: false,
          is_primary_key: true,
          is_identity: true,
        },
      ])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create table")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create table</DialogTitle>
          <DialogDescription>
            Creates the table, then adds columns via postgres-meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="schema">Schema</Label>
              <select
                id="schema"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
              >
                {schemas.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                {!schemas.length ? <option value="public">public</option> : null}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="table-name">Table name</Label>
              <Input
                id="table-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="users"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="table-comment">Comment (optional)</Label>
            <Input
              id="table-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setColumns((prev) => [...prev, emptyColumnDraft()])}
              >
                <Plus className="size-3.5" />
                Add column
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-2">
              {columns.map((col, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-md bg-muted/30 p-2 md:grid-cols-[1.2fr_1fr_auto]"
                >
                  <Input
                    placeholder="column_name"
                    value={col.name}
                    onChange={(e) => updateColumn(index, { name: e.target.value })}
                  />
                  <select
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                    value={col.type}
                    onChange={(e) => updateColumn(index, { type: e.target.value })}
                  >
                    {COMMON_COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={columns.length <= 1}
                    onClick={() =>
                      setColumns((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>

                  <div className="flex flex-wrap gap-3 md:col-span-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={col.is_nullable}
                        disabled={col.is_identity || col.is_primary_key}
                        onCheckedChange={(v) =>
                          updateColumn(index, { is_nullable: v === true })
                        }
                      />
                      Nullable
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={col.is_primary_key}
                        onCheckedChange={(v) =>
                          updateColumn(index, {
                            is_primary_key: v === true,
                            is_nullable: v === true ? false : col.is_nullable,
                          })
                        }
                      />
                      Primary key
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={col.is_identity}
                        onCheckedChange={(v) =>
                          updateColumn(index, {
                            is_identity: v === true,
                            is_nullable: v === true ? false : col.is_nullable,
                            type: v === true ? "int8" : col.type,
                          })
                        }
                      />
                      Identity
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={col.is_unique}
                        onCheckedChange={(v) =>
                          updateColumn(index, { is_unique: v === true })
                        }
                      />
                      Unique
                    </label>
                  </div>
                  <Input
                    className="md:col-span-2"
                    placeholder="Default (expression)"
                    value={col.default_value}
                    disabled={col.is_identity}
                    onChange={(e) =>
                      updateColumn(index, { default_value: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Create table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
