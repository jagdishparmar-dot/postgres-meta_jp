"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { TableStructurePanel } from "@/components/studio/table-structure-panel"
import { CsvImportDialog } from "@/components/studio/csv-import-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import { studioPath } from "@/lib/platform/paths"
import { runQuery } from "@/lib/sql"
import { dropTable, renameTable } from "@/lib/schema-ddl"
import {
  browseTableRows,
  buildDeleteSql,
  buildInsertSql,
  buildUpdateSql,
  editableColumns,
  fetchTableMeta,
  getPrimaryKeyColumns,
  inputToValue,
  valueToInput,
  type SortDir,
} from "@/lib/table-data"
import type { PostgresColumn, PostgresTable } from "@/lib/types"

const PAGE_SIZE = 50

function cellDisplay(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

type RowFormState = {
  mode: "insert" | "edit"
  values: Record<string, string>
  nulls: Record<string, boolean>
  original?: Record<string, unknown>
}

export function TableDataPageClient({
  schema,
  name,
}: {
  schema: string
  name: string
}) {
  const router = useRouter()
  const { projectId } = useProject()
  const { connection, ready } = useStudioConnection()
  const [table, setTable] = useState<PostgresTable | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState("")
  const [filterInput, setFilterInput] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<RowFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [tab, setTab] = useState<"data" | "structure">("data")
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [currentName, setCurrentName] = useState(name)
  const [csvOpen, setCsvOpen] = useState(false)

  const columns = useMemo(
    () =>
      [...(table?.columns || [])].sort(
        (a, b) => a.ordinal_position - b.ordinal_position
      ),
    [table]
  )
  const pkColumns = useMemo(
    () => (table ? getPrimaryKeyColumns(table) : []),
    [table]
  )
  const canMutate = pkColumns.length > 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadRows = useCallback(
    async (meta: PostgresTable) => {
      if (!connection) return
      setLoading(true)
      try {
        const data = await browseTableRows(
          {
            schema,
            table: currentName,
            columns: meta.columns || [],
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            sortColumn,
            sortDir,
            filter,
          },
          connection
        )
        setRows(data.rows)
        setTotal(data.total)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load rows"
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [connection, schema, currentName, page, sortColumn, sortDir, filter]
  )

  useEffect(() => {
    if (!ready || !connection) return
    let cancelled = false
    void (async () => {
      try {
        const meta = await fetchTableMeta(schema, currentName, connection)
        if (cancelled) return
        setTable(meta)
      } catch (err) {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : "Table not found")
        router.push(studioPath(projectId, "/tables"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, connection, schema, currentName, router])

  useEffect(() => {
    if (!table || !connection || tab !== "data") return
    void loadRows(table)
  }, [table, connection, loadRows, tab])

  async function reloadMeta() {
    if (!connection) return
    const meta = await fetchTableMeta(schema, currentName, connection)
    setTable(meta)
    if (tab === "data") await loadRows(meta)
  }

  async function onRename() {
    if (!connection || !table || !renameValue.trim()) return
    try {
      const updated = await renameTable(
        table.id,
        renameValue.trim(),
        connection
      )
      toast.success(`Renamed to ${updated.name}`)
      setRenameOpen(false)
      setCurrentName(updated.name)
      router.replace(
        studioPath(
          projectId,
          `/tables/${encodeURIComponent(updated.schema)}/${encodeURIComponent(updated.name)}`
        )
      )
      const meta = await fetchTableMeta(
        updated.schema,
        updated.name,
        connection
      )
      setTable(meta)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed")
    }
  }

  async function onDropTable() {
    if (!connection || !table) return
    if (
      !confirm(
        `Drop table ${table.schema}.${table.name}? This uses CASCADE and cannot be undone.`
      )
    ) {
      return
    }
    try {
      await dropTable(table.id, connection, true)
      toast.success(`Dropped ${table.schema}.${table.name}`)
      router.push(studioPath(projectId, "/tables"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drop failed")
    }
  }

  function toggleSort(col: string) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(col)
      setSortDir("asc")
    }
    setPage(0)
  }

  function openInsert() {
    const values: Record<string, string> = {}
    const nulls: Record<string, boolean> = {}
    for (const col of editableColumns(columns)) {
      if (col.is_identity) continue
      values[col.name] = ""
      nulls[col.name] = !!col.is_nullable && !col.default_value
    }
    setForm({ mode: "insert", values, nulls })
  }

  function openEdit(row: Record<string, unknown>) {
    const values: Record<string, string> = {}
    const nulls: Record<string, boolean> = {}
    for (const col of editableColumns(columns)) {
      const v = row[col.name]
      nulls[col.name] = v === null || v === undefined
      values[col.name] = valueToInput(v)
    }
    setForm({ mode: "edit", values, nulls, original: row })
  }

  async function saveForm() {
    if (!connection || !form || !table) return
    setSaving(true)
    try {
      if (form.mode === "insert") {
        const payload: Record<string, unknown> = {}
        for (const col of editableColumns(columns)) {
          if (col.is_identity) continue
          if (form.nulls[col.name]) {
            if (col.is_nullable) payload[col.name] = null
            continue
          }
          if (form.values[col.name] === "" && col.default_value) continue
          payload[col.name] = inputToValue(
            form.values[col.name] ?? "",
            col,
            false
          )
        }
        const { sql, parameters } = buildInsertSql({
          schema,
          table: currentName,
          values: payload,
        })
        await runQuery(sql, connection, parameters)
        toast.success("Row inserted")
      } else {
        const changes: Record<string, unknown> = {}
        for (const col of editableColumns(columns)) {
          if (pkColumns.includes(col.name)) continue
          const wasNull =
            form.original?.[col.name] === null ||
            form.original?.[col.name] === undefined
          const nowNull = !!form.nulls[col.name]
          const next = nowNull
            ? null
            : inputToValue(form.values[col.name] ?? "", col, false)
          const prev = form.original?.[col.name]
          const changed =
            nowNull !== wasNull ||
            JSON.stringify(next) !== JSON.stringify(prev)
          if (changed) changes[col.name] = next
        }
        if (!Object.keys(changes).length) {
          toast.message("No changes to save")
          setForm(null)
          return
        }
        const pkValues: Record<string, unknown> = {}
        for (const key of pkColumns) {
          pkValues[key] = form.original?.[key]
        }
        const { sql, parameters } = buildUpdateSql({
          schema,
          table: currentName,
          pkColumns,
          pkValues,
          changes,
        })
        await runQuery(sql, connection, parameters)
        toast.success("Row updated")
      }
      setForm(null)
      if (table) await loadRows(table)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!connection || !canMutate) return
    if (!confirm("Delete this row? This cannot be undone.")) return
    try {
      const pkValues: Record<string, unknown> = {}
      for (const key of pkColumns) pkValues[key] = row[key]
      const { sql, parameters } = buildDeleteSql({
        schema,
        table: currentName,
        pkColumns,
        pkValues,
      })
      await runQuery(sql, connection, parameters)
      toast.success("Row deleted")
      setSelected(null)
      if (table) await loadRows(table)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (!ready || !connection) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading connection…
      </div>
    )
  }

  return (
    <>
      <StudioShell
        connection={connection}
        title={`${schema}.${currentName}`}
        subtitle="Table data and structure"
        refreshing={loading}
        onRefresh={() => {
          void reloadMeta()
        }}
        toolbar={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(studioPath(projectId, "/tables"))}
              >
                <ArrowLeft className="size-3.5" />
                Tables
              </Button>
              <div className="flex rounded-lg border border-border p-0.5">
                <Button
                  size="xs"
                  variant={tab === "data" ? "default" : "ghost"}
                  onClick={() => setTab("data")}
                >
                  Data
                </Button>
                <Button
                  size="xs"
                  variant={tab === "structure" ? "default" : "ghost"}
                  onClick={() => setTab("structure")}
                >
                  Structure
                </Button>
              </div>
              {tab === "data" ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setPage(0)
                    setFilter(filterInput)
                  }}
                >
                  <Input
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    placeholder="Filter rows…"
                    className="h-7 w-48"
                  />
                  <Button size="sm" type="submit" variant="secondary">
                    Apply
                  </Button>
                </form>
              ) : null}
              {!canMutate && tab === "data" ? (
                <Badge variant="outline" className="font-normal">
                  Read-only (no primary key)
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {tab === "data" ? (
                <Badge variant="secondary" className="font-normal">
                  {total.toLocaleString()} row{total === 1 ? "" : "s"}
                </Badge>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRenameValue(currentName)
                  setRenameOpen(true)
                }}
              >
                Rename
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onDropTable()}>
                <Trash2 className="size-3.5 text-destructive" />
                Drop
              </Button>
              {tab === "data" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCsvOpen(true)}
                  >
                    <Upload className="size-3.5" />
                    Import CSV
                  </Button>
                  <Button size="sm" onClick={openInsert} disabled={!canMutate}>
                    <Plus className="size-3.5" />
                    Insert
                  </Button>
                </>
              ) : null}
            </div>
          </>
        }
      >
        {tab === "structure" && table ? (
          <TableStructurePanel
            table={table}
            connection={connection}
            onChanged={() => void reloadMeta()}
          />
        ) : (
        <div className="flex min-h-[60vh] flex-col">
          {loading && rows.length === 0 ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No rows match this view
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {canMutate ? <TableHead className="w-20">Actions</TableHead> : null}
                    {columns.map((col) => {
                      const active = sortColumn === col.name
                      return (
                        <TableHead key={col.name}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() => toggleSort(col.name)}
                          >
                            <span className="font-mono text-xs">{col.name}</span>
                            {active ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="size-3 text-primary" />
                              ) : (
                                <ArrowDown className="size-3 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className="cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      {canMutate ? (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => void deleteRow(row)}
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                      {columns.map((col) => {
                        const value = row[col.name]
                        const isNull = value === null || value === undefined
                        return (
                          <TableCell
                            key={col.name}
                            className={
                              isNull
                                ? "font-mono text-xs text-muted-foreground italic"
                                : "max-w-[220px] truncate font-mono text-xs"
                            }
                            title={cellDisplay(value)}
                          >
                            {cellDisplay(value)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
        )}
      </StudioShell>

      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        schema={schema}
        table={currentName}
        onImported={() => {
          if (table) void loadRows(table)
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename table</DialogTitle>
            <DialogDescription>
              {schema}.{currentName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-table">New name</Label>
            <Input
              id="rename-table"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void onRename()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open) setForm(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form?.mode === "insert" ? "Insert row" : "Edit row"}
            </DialogTitle>
            <DialogDescription>
              {schema}.{name}
              {!canMutate
                ? " — primary key required for edits"
                : " · empty + nullable saves as NULL"}
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-3 py-2">
              {editableColumns(columns)
                .filter((c) => !(form.mode === "insert" && c.is_identity))
                .map((col) => {
                  const locked =
                    form.mode === "edit" && pkColumns.includes(col.name)
                  return (
                    <div key={col.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`f-${col.name}`} className="font-mono">
                          {col.name}
                          <span className="ml-1 text-muted-foreground">
                            {col.format || col.data_type}
                          </span>
                        </Label>
                        {col.is_nullable && !locked ? (
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Checkbox
                              checked={!!form.nulls[col.name]}
                              onCheckedChange={(checked) =>
                                setForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        nulls: {
                                          ...prev.nulls,
                                          [col.name]: checked === true,
                                        },
                                      }
                                    : prev
                                )
                              }
                            />
                            NULL
                          </label>
                        ) : null}
                      </div>
                      <Input
                        id={`f-${col.name}`}
                        value={form.values[col.name] ?? ""}
                        disabled={locked || !!form.nulls[col.name]}
                        onChange={(e) =>
                          setForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  values: {
                                    ...prev.values,
                                    [col.name]: e.target.value,
                                  },
                                  nulls: {
                                    ...prev.nulls,
                                    [col.name]: false,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                  )
                })}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveForm()} disabled={saving || !canMutate}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Row detail</DialogTitle>
            <DialogDescription>
              {schema}.{name}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2">
              {columns.map((col) => (
                <div
                  key={col.name}
                  className="grid grid-cols-[120px_1fr] gap-2 border-b border-border/60 py-1.5 text-xs"
                >
                  <span className="font-mono text-muted-foreground">
                    {col.name}
                  </span>
                  <span
                    className={
                      selected[col.name] === null
                        ? "font-mono italic text-muted-foreground"
                        : "break-all font-mono"
                    }
                  >
                    {cellDisplay(selected[col.name])}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            {selected && canMutate ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    openEdit(selected)
                    setSelected(null)
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void deleteRow(selected)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
