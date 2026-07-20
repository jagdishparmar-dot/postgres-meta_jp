"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BoolBadge } from "@/components/studio/cells"
import type { PostgresColumn, PostgresTable } from "@/lib/types"

type TableDetailSheetProps = {
  table: PostgresTable | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TableDetailSheet({
  table,
  open,
  onOpenChange,
}: TableDetailSheetProps) {
  const columns = table?.columns ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {table ? `${table.schema}.${table.name}` : "Table"}
          </SheetTitle>
          <SheetDescription>
            {table?.comment || "Column definitions for this table"}
          </SheetDescription>
        </SheetHeader>

        {table ? (
          <div className="mt-4 space-y-4 px-1">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{table.size}</Badge>
              <Badge variant="outline">
                ~{table.live_rows_estimate.toLocaleString()} rows
              </Badge>
              <BoolBadge
                value={table.rls_enabled}
                trueLabel="RLS on"
                falseLabel="RLS off"
              />
              {table.primary_keys?.length ? (
                <Badge variant="outline">
                  PK: {table.primary_keys.map((k) => k.name).join(", ")}
                </Badge>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Null</TableHead>
                    <TableHead>Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No column metadata returned
                      </TableCell>
                    </TableRow>
                  ) : (
                    columns.map((col: PostgresColumn) => (
                      <TableRow key={col.id}>
                        <TableCell className="font-medium">{col.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {col.format || col.data_type}
                        </TableCell>
                        <TableCell>
                          <BoolBadge value={col.is_nullable} />
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-xs text-muted-foreground">
                          {col.default_value ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
