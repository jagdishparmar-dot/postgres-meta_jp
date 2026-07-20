"use client"

import { useEffect, useState } from "react"
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
  createOrReplaceView,
  getViewDefinition,
  listSchemas,
} from "@/lib/schema-ddl"
import type { PostgresSchema, PostgresView } from "@/lib/types"

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

type ViewEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  view?: PostgresView | null
  onSaved: () => void
}

export function ViewEditorDialog({
  open,
  onOpenChange,
  connection,
  view,
  onSaved,
}: ViewEditorDialogProps) {
  const isEdit = Boolean(view)
  const [schemas, setSchemas] = useState<PostgresSchema[]>([])
  const [name, setName] = useState("")
  const [schema, setSchema] = useState("public")
  const [definition, setDefinition] = useState("SELECT 1")
  const [loadingDef, setLoadingDef] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void listSchemas(connection)
      .then((list) => {
        setSchemas(list)
        if (!view && list.some((s) => s.name === "public")) setSchema("public")
        else if (!view && list[0]) setSchema(list[0].name)
      })
      .catch(() => setSchemas([]))

    if (view) {
      setName(view.name)
      setSchema(view.schema)
      setLoadingDef(true)
      void getViewDefinition(view.schema, view.name, connection)
        .then((def) => setDefinition(def || "SELECT 1"))
        .catch(() => setDefinition("SELECT 1"))
        .finally(() => setLoadingDef(false))
    } else {
      setName("")
      setDefinition("SELECT 1")
    }
  }, [open, connection, view])

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("View name is required")
      return
    }
    if (!definition.trim()) {
      toast.error("SELECT definition is required")
      return
    }
    setSaving(true)
    try {
      await createOrReplaceView(
        {
          schema,
          name: name.trim(),
          definition: definition.trim(),
        },
        connection
      )
      toast.success(
        isEdit ? `Updated view ${name.trim()}` : `Created view ${name.trim()}`
      )
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save view")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit view" : "Create view"}</DialogTitle>
          <DialogDescription>
            Runs CREATE OR REPLACE VIEW with your SELECT definition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Schema</Label>
              <select
                className={selectClass}
                value={schema}
                disabled={isEdit}
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
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={name}
                disabled={isEdit}
                onChange={(e) => setName(e.target.value)}
                placeholder="my_view"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="view-def">Definition (SELECT …)</Label>
            {loadingDef ? (
              <p className="text-xs text-muted-foreground">Loading definition…</p>
            ) : (
              <Textarea
                id="view-def"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={saving || loadingDef}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isEdit ? "Save view" : "Create view"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
