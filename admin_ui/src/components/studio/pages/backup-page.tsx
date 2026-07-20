"use client"

import { useState } from "react"
import { Archive, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"

export function BackupPageClient() {
  const { project } = useProject()
  const { connection, ready } = useStudioConnection()
  const [includeData, setIncludeData] = useState(false)
  const [schemaOnly, setSchemaOnly] = useState(true)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState("")

  async function createBackup() {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_data: includeData && !schemaOnly,
          schema_only: schemaOnly || !includeData,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Backup failed")
      setPreview(data.sql || "")
      toast.success("Backup SQL generated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed")
    } finally {
      setLoading(false)
    }
  }

  function download() {
    if (!preview) return
    const blob = new Blob([preview], { type: "application/sql;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project?.database_name || "database"}-backup.sql`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <StudioShell
      connection={connection}
      title="Backup"
      subtitle={`Logical SQL dump for ${project?.database_name || "database"}`}
      toolbar={
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={schemaOnly}
                onCheckedChange={(v) => {
                  setSchemaOnly(Boolean(v))
                  if (v) setIncludeData(false)
                }}
              />
              Schema only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeData}
                onCheckedChange={(v) => {
                  setIncludeData(Boolean(v))
                  if (v) setSchemaOnly(false)
                }}
              />
              Include table data
            </label>
            <Button size="sm" onClick={() => void createBackup()} disabled={loading}>
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Archive className="size-3.5" />
              )}
              Generate dump
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!preview}
            onClick={download}
          >
            <Download className="size-3.5" />
            Download .sql
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-4">
        <Alert>
          <AlertDescription className="text-xs">
            Generates a logical SQL dump via catalog introspection (CREATE TABLE /
            INSERT). For full{" "}
            <code className="text-[11px]">pg_dump</code> fidelity, run pg_dump on
            the host. Large tables with “Include data” may be truncated per table.
          </AlertDescription>
        </Alert>
        <div className="space-y-1.5">
          <Label>Preview</Label>
          <Textarea
            value={preview}
            readOnly
            rows={22}
            className="font-mono text-[11px]"
            placeholder="Generate a dump to preview SQL here…"
          />
        </div>
      </div>
    </StudioShell>
  )
}
