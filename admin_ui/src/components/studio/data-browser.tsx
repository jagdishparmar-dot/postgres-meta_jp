"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ColumnDef<T> = {
  key: string
  header: string
  className?: string
  searchable?: boolean
  cell: (row: T) => ReactNode
}

type DataBrowserProps<T> = {
  rows: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  getRowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  searchPlaceholder?: string
}

export function DataBrowser<T>({
  rows,
  columns,
  loading,
  emptyTitle = "No items found",
  emptyDescription,
  getRowKey,
  onRowClick,
  searchPlaceholder = "Filter…",
}: DataBrowserProps<T>) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      try {
        return JSON.stringify(row).toLowerCase().includes(q)
      } catch {
        return false
      }
    })
  }, [rows, query])

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8"
          />
        </div>
        <p className="ml-auto text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${rows.length}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {emptyDescription}
            </p>
          ) : null}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow
                key={getRowKey(row)}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
