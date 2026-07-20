"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { setPrimaryKeys } from "@/lib/schema-ddl"
import type { PostgresColumn, PostgresTable } from "@/lib/types"

type PrimaryKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  table: PostgresTable
  onSaved: () => void
}

export function PrimaryKeyDialog({
  open,
  onOpenChange,
  connection,
  table,
  onSaved,
}: PrimaryKeyDialogProps) {
  const columns = [...(table.columns || [])].sort(
    (a, b) => a.ordinal_position - b.ordinal_position
  )
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected((table.primary_keys || []).map((pk) => pk.name))
  }, [open, table.primary_keys])

  function toggle(col: PostgresColumn) {
    setSelected((prev) =>
      prev.includes(col.name)
        ? prev.filter((n) => n !== col.name)
        : [...prev, col.name]
    )
  }

  async function onSubmit() {
    setSaving(true)
    try {
      await setPrimaryKeys(table.id, selected, connection)
      toast.success(
        selected.length
          ? `Primary key set (${selected.join(", ")})`
          : "Primary key removed"
      )
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update PK")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Primary key</DialogTitle>
          <DialogDescription>
            Choose columns that form the primary key for{" "}
            <span className="font-mono">
              {table.schema}.{table.name}
            </span>
            . Clearing all removes the constraint.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
          {columns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No columns available
            </p>
          ) : (
            columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.includes(col.name)}
                  onCheckedChange={() => toggle(col)}
                />
                <span className="font-mono text-xs">{col.name}</span>
                <span className="text-xs text-muted-foreground">
                  {col.format || col.data_type}
                </span>
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Selected: {selected.length ? selected.join(", ") : "none"}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save primary key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
