"use client"

import { useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { buildCsvInsertSql, parseCsv, runQuery } from "@/lib/sql"

type CsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  onImported?: () => void
}

export function CsvImportDialog({
  open,
  onOpenChange,
  schema,
  table,
  onImported,
}: CsvImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewCols, setPreviewCols] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [sql, setSql] = useState("")
  const [truncate, setTruncate] = useState(false)
  const [importing, setImporting] = useState(false)

  function reset() {
    setFileName(null)
    setPreviewCols([])
    setRowCount(0)
    setSql("")
    setTruncate(false)
  }

  async function onFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    const parsed = parseCsv(text)
    if (!parsed.columns.length || !parsed.rows.length) {
      toast.error("CSV has no data rows")
      return
    }
    setFileName(file.name)
    setPreviewCols(parsed.columns)
    setRowCount(parsed.rows.length)
    setSql(buildCsvInsertSql(schema, table, parsed.columns, parsed.rows))
  }

  async function onImport() {
    if (!sql.trim()) {
      toast.error("Choose a CSV file first")
      return
    }
    setImporting(true)
    try {
      if (truncate) {
        await runQuery(
          `TRUNCATE TABLE "${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"`
        )
      }
      // Run statements sequentially (may be chunked)
      const parts = sql
        .split(/;\s*\n\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const part of parts) {
        const stmt = part.endsWith(";") ? part : `${part};`
        await runQuery(stmt)
      }
      toast.success(`Imported ${rowCount} row(s) into ${schema}.${table}`)
      onOpenChange(false)
      reset()
      onImported?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Load rows into{" "}
            <code className="text-xs">
              {schema}.{table}
            </code>
            . First row must be column headers matching table columns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="csv-file">CSV file</Label>
            <InputFile
              id="csv-file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            {fileName ? (
              <p className="text-xs text-muted-foreground">
                {fileName} · {rowCount} rows · {previewCols.length} columns
              </p>
            ) : null}
          </div>
          {previewCols.length ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Columns: {previewCols.join(", ")}
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={truncate}
              onCheckedChange={(v) => setTruncate(Boolean(v))}
            />
            Truncate table before import
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onImport()} disabled={importing || !sql}>
            {importing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InputFile({
  id,
  accept,
  onChange,
}: {
  id: string
  accept?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      id={id}
      type="file"
      accept={accept}
      onChange={onChange}
      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium"
    />
  )
}
