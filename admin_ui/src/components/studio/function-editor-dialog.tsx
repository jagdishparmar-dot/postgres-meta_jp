"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { createFunction, listSchemas, updateFunction } from "@/lib/schema-ddl"
import type { PostgresFunction, PostgresSchema } from "@/lib/types"

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

type FunctionEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection: DbConnectionConfig
  fn?: PostgresFunction | null
  onSaved: () => void
}

export function FunctionEditorDialog({
  open,
  onOpenChange,
  connection,
  fn,
  onSaved,
}: FunctionEditorDialogProps) {
  const isEdit = Boolean(fn)
  const [schemas, setSchemas] = useState<PostgresSchema[]>([])
  const [name, setName] = useState("")
  const [schema, setSchema] = useState("public")
  const [args, setArgs] = useState("")
  const [returnType, setReturnType] = useState("void")
  const [language, setLanguage] = useState("plpgsql")
  const [behavior, setBehavior] = useState("VOLATILE")
  const [securityDefiner, setSecurityDefiner] = useState(false)
  const [definition, setDefinition] = useState("BEGIN\n  -- body\nEND;")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void listSchemas(connection)
      .then((list) => {
        setSchemas(list)
        if (!fn && list.some((s) => s.name === "public")) setSchema("public")
        else if (!fn && list[0]) setSchema(list[0].name)
      })
      .catch(() => setSchemas([]))

    if (fn) {
      setName(fn.name)
      setSchema(fn.schema)
      setArgs(fn.argument_types || "")
      setReturnType(fn.return_type || "void")
      setLanguage(fn.language || "plpgsql")
      setBehavior(fn.behavior || "VOLATILE")
      setSecurityDefiner(fn.security_definer)
      setDefinition(fn.definition || "")
    } else {
      setName("")
      setArgs("")
      setReturnType("void")
      setLanguage("plpgsql")
      setBehavior("VOLATILE")
      setSecurityDefiner(false)
      setDefinition("BEGIN\n  -- body\nEND;")
    }
  }, [open, connection, fn])

  async function onSubmit() {
    if (!name.trim()) {
      toast.error("Function name is required")
      return
    }
    if (!definition.trim()) {
      toast.error("Function body is required")
      return
    }
    setSaving(true)
    try {
      if (isEdit && fn) {
        await updateFunction(
          fn.id,
          {
            name: name.trim() !== fn.name ? name.trim() : undefined,
            schema: schema !== fn.schema ? schema : undefined,
            definition: definition.trim(),
          },
          connection
        )
        toast.success(`Updated function ${name.trim()}`)
      } else {
        const argList = args
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
        await createFunction(
          {
            name: name.trim(),
            schema,
            args: argList,
            definition: definition.trim(),
            return_type: returnType.trim() || "void",
            language,
            behavior,
            security_definer: securityDefiner,
          },
          connection
        )
        toast.success(`Created function ${name.trim()}`)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save function"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit function" : "Create function"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the function body (CREATE OR REPLACE). Rename/schema optional."
              : "Creates a function via postgres-meta."}
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
              <Label htmlFor="fn-name">Name</Label>
              <Input
                id="fn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my_fn"
              />
            </div>
          </div>

          {!isEdit ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fn-args">Arguments (comma-separated)</Label>
                <Input
                  id="fn-args"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="id int, label text"
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn-return">Returns</Label>
                  <Input
                    id="fn-return"
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <select
                    className={selectClass}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="plpgsql">plpgsql</option>
                    <option value="sql">sql</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Behavior</Label>
                  <select
                    className={selectClass}
                    value={behavior}
                    onChange={(e) => setBehavior(e.target.value)}
                  >
                    <option value="VOLATILE">VOLATILE</option>
                    <option value="STABLE">STABLE</option>
                    <option value="IMMUTABLE">IMMUTABLE</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={securityDefiner}
                  onCheckedChange={(v) => setSecurityDefiner(v === true)}
                />
                SECURITY DEFINER
              </label>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="fn-body">Body / definition</Label>
            <Textarea
              id="fn-body"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              rows={10}
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
            {isEdit ? "Save function" : "Create function"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
