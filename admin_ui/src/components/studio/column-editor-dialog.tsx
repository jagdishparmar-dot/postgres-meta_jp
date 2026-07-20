"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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
  addColumn,
  emptyColumnDraft,
  updateColumn,
  type ColumnDraft,
} from "@/lib/schema-ddl"
import type { PostgresColumn } from "@/lib/types"

type ColumnEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  tableId: number
  mode: "add" | "edit"
  column?: PostgresColumn | null
  onSaved: () => void
}

export function ColumnEditorDialog({
  open,
  onOpenChange,
  connection,
  tableId,
  mode,
  column,
  onSaved,
}: ColumnEditorDialogProps) {
  const [draft, setDraft] = useState<ColumnDraft>(emptyColumnDraft())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && column) {
      setDraft({
        name: column.name,
        type: column.format || column.data_type || "text",
        is_nullable: column.is_nullable,
        is_unique: column.is_unique,
        is_primary_key: false,
        is_identity: column.is_identity,
        default_value:
          column.default_value === null || column.default_value === undefined
            ? ""
            : String(column.default_value),
        comment: column.comment || "",
      })
    } else {
      setDraft(emptyColumnDraft())
    }
  }, [open, mode, column])

  async function onSubmit() {
    if (!draft.name.trim()) {
      toast.error("Column name is required")
      return
    }
    setSaving(true)
    try {
      if (mode === "add") {
        await addColumn(tableId, draft, connection)
        toast.success(`Added column ${draft.name}`)
      } else if (column) {
        await updateColumn(
          column.id,
          {
            name: draft.name.trim(),
            type: draft.type,
            is_nullable: draft.is_nullable,
            is_unique: draft.is_unique,
            default_value: draft.default_value.trim() || null,
            comment: draft.comment.trim(),
          },
          connection
        )
        toast.success(`Updated column ${draft.name}`)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Column save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add column" : "Edit column"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Renames, type changes, and nullability use ALTER COLUMN."
              : "Adds a column to this table."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="col-name">Name</Label>
            <Input
              id="col-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="col-type">Type</Label>
            <select
              id="col-type"
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
            >
              {!COMMON_COLUMN_TYPES.includes(
                draft.type as (typeof COMMON_COLUMN_TYPES)[number]
              ) ? (
                <option value={draft.type}>{draft.type}</option>
              ) : null}
              {COMMON_COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="col-default">Default (expression)</Label>
            <Input
              id="col-default"
              value={draft.default_value}
              disabled={draft.is_identity}
              onChange={(e) =>
                setDraft((d) => ({ ...d, default_value: e.target.value }))
              }
              placeholder="e.g. now() or 'active'"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="col-comment">Comment</Label>
            <Input
              id="col-comment"
              value={draft.comment}
              onChange={(e) =>
                setDraft((d) => ({ ...d, comment: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={draft.is_nullable}
                disabled={draft.is_identity}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, is_nullable: v === true }))
                }
              />
              Nullable
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={draft.is_unique}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, is_unique: v === true }))
                }
              />
              Unique
            </label>
            {mode === "add" ? (
              <>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={draft.is_primary_key}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        is_primary_key: v === true,
                        is_nullable: v === true ? false : d.is_nullable,
                      }))
                    }
                  />
                  Primary key
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={draft.is_identity}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        is_identity: v === true,
                        is_nullable: v === true ? false : d.is_nullable,
                        type: v === true ? "int8" : d.type,
                      }))
                    }
                  />
                  Identity
                </label>
              </>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
