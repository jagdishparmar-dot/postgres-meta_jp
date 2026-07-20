"use client"

import { useMemo, useState } from "react"
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnEditorDialog } from "@/components/studio/column-editor-dialog"
import { PrimaryKeyDialog } from "@/components/studio/primary-key-dialog"
import { ForeignKeyDialog } from "@/components/studio/foreign-key-dialog"
import { BoolBadge } from "@/components/studio/cells"
import type { DbConnectionConfig } from "@/lib/connection"
import {
  dropColumn,
  dropForeignKey,
  groupOutgoingForeignKeys,
} from "@/lib/schema-ddl"
import type { PostgresColumn, PostgresTable } from "@/lib/types"

type TableStructurePanelProps = {
  table: PostgresTable
  connection: DbConnectionConfig
  onChanged: () => void
}

export function TableStructurePanel({
  table,
  connection,
  onChanged,
}: TableStructurePanelProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [pkOpen, setPkOpen] = useState(false)
  const [fkOpen, setFkOpen] = useState(false)
  const [mode, setMode] = useState<"add" | "edit">("add")
  const [selected, setSelected] = useState<PostgresColumn | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const columns = useMemo(
    () =>
      [...(table.columns || [])].sort(
        (a, b) => a.ordinal_position - b.ordinal_position
      ),
    [table.columns]
  )

  const pkNames = useMemo(
    () => new Set((table.primary_keys || []).map((pk) => pk.name)),
    [table.primary_keys]
  )

  const foreignKeys = useMemo(
    () => groupOutgoingForeignKeys(table),
    [table]
  )

  async function onDrop(col: PostgresColumn) {
    if (
      !confirm(
        `Drop column "${col.name}"? Dependent objects may be removed (CASCADE).`
      )
    ) {
      return
    }
    setBusyId(col.id)
    try {
      await dropColumn(col.id, connection, true)
      toast.success(`Dropped column ${col.name}`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drop failed")
    } finally {
      setBusyId(null)
    }
  }

  async function onDropFk(constraintName: string) {
    if (!confirm(`Drop foreign key "${constraintName}"?`)) return
    setBusyId(constraintName)
    try {
      await dropForeignKey(table, constraintName, connection)
      toast.success(`Dropped ${constraintName}`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drop failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <section className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Columns</p>
          <Button
            size="sm"
            onClick={() => {
              setMode("add")
              setSelected(null)
              setEditorOpen(true)
            }}
          >
            <Plus className="size-3.5" />
            Add column
          </Button>
        </div>

        {columns.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No columns yet — add one to get started
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">Actions</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => {
                          setMode("edit")
                          setSelected(col)
                          setEditorOpen(true)
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={busyId === col.id}
                        onClick={() => void onDrop(col)}
                      >
                        {busyId === col.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Trash2 className="size-3 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">
                    {col.name}
                    {pkNames.has(col.name) ? (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-[10px]"
                      >
                        PK
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {col.format || col.data_type}
                  </TableCell>
                  <TableCell>
                    <BoolBadge value={col.is_nullable} />
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                    {col.default_value === null ||
                    col.default_value === undefined
                      ? "—"
                      : String(col.default_value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {col.is_identity ? (
                        <Badge variant="secondary" className="text-[10px]">
                          identity
                        </Badge>
                      ) : null}
                      {col.is_unique ? (
                        <Badge variant="outline" className="text-[10px]">
                          unique
                        </Badge>
                      ) : null}
                      {col.is_generated ? (
                        <Badge variant="outline" className="text-[10px]">
                          generated
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <KeyRound className="size-3.5 text-primary" />
            <p className="text-sm font-medium">Primary key</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPkOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        <div className="px-3 py-3 text-sm">
          {(table.primary_keys || []).length ? (
            <p className="font-mono text-xs">
              {(table.primary_keys || []).map((pk) => pk.name).join(", ")}
            </p>
          ) : (
            <p className="text-muted-foreground">No primary key defined</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Foreign keys</p>
          <Button size="sm" onClick={() => setFkOpen(true)}>
            <Plus className="size-3.5" />
            Add FK
          </Button>
        </div>
        {foreignKeys.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No outgoing foreign keys
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12" />
                <TableHead>Constraint</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>References</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreignKeys.map((fk) => (
                <TableRow key={fk.constraint_name}>
                  <TableCell>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={busyId === fk.constraint_name}
                      onClick={() => void onDropFk(fk.constraint_name)}
                    >
                      {busyId === fk.constraint_name ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fk.constraint_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fk.columns.join(", ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fk.referenced_schema}.{fk.referenced_table} (
                    {fk.referenced_columns.join(", ")})
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <ColumnEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        connection={connection}
        tableId={table.id}
        mode={mode}
        column={selected}
        onSaved={onChanged}
      />
      <PrimaryKeyDialog
        open={pkOpen}
        onOpenChange={setPkOpen}
        connection={connection}
        table={table}
        onSaved={onChanged}
      />
      <ForeignKeyDialog
        open={fkOpen}
        onOpenChange={setFkOpen}
        connection={connection}
        table={table}
        onSaved={onChanged}
      />
    </div>
  )
}
