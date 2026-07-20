"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { createSchema, updateSchema } from "@/lib/schema-ddl"
import type { PostgresSchema } from "@/lib/types"

type SchemaEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  schema?: PostgresSchema | null
  onSaved: () => void
}

export function SchemaEditorDialog({
  open,
  onOpenChange,
  connection,
  schema,
  onSaved,
}: SchemaEditorDialogProps) {
  const isEdit = Boolean(schema)
  const [name, setName] = useState("")
  const [owner, setOwner] = useState("postgres")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(schema?.name || "")
    setOwner(schema?.owner || "postgres")
  }, [open, schema])

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("Schema name is required")
      return
    }
    setSaving(true)
    try {
      if (isEdit && schema) {
        await updateSchema(
          schema.id,
          {
            name: name.trim() !== schema.name ? name.trim() : undefined,
            owner: owner.trim() !== schema.owner ? owner.trim() : undefined,
          },
          connection
        )
        toast.success(`Updated schema ${name.trim()}`)
      } else {
        await createSchema(
          { name: name.trim(), owner: owner.trim() || undefined },
          connection
        )
        toast.success(`Created schema ${name.trim()}`)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save schema")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit schema" : "Create schema"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename the schema or change its owner."
              : "Creates a new Postgres schema."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="schema-name">Name</Label>
            <Input
              id="schema-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="app"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schema-owner">Owner</Label>
            <Input
              id="schema-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="postgres"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
