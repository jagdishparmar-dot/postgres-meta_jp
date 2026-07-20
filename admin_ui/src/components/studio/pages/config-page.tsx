"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { StudioShell } from "@/components/studio/studio-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { fetchMeta } from "@/lib/client-meta"

type ConfigRow = {
  name: string
  setting: string
  unit?: string | null
  category?: string | null
  short_desc?: string | null
  context?: string | null
  vartype?: string | null
}

export function ConfigPageClient() {
  const { connection, ready } = useStudioConnection()
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMeta<ConfigRow[]>("config")
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load config")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.setting?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.short_desc?.toLowerCase().includes(q)
    )
  }, [rows, filter])

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
      title="Database config"
      subtitle="PostgreSQL configuration parameters (read-only)"
      refreshing={loading}
      onRefresh={() => void load()}
      toolbar={
        <>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter settings…"
            className="h-8 max-w-xs"
          />
          <Badge variant="secondary" className="font-normal">
            {filtered.length} / {rows.length}
          </Badge>
        </>
      }
    >
      {loading && !rows.length ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading config…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[220px]">Name</TableHead>
              <TableHead>Setting</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-mono text-xs">{row.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.setting}
                  {row.unit ? (
                    <span className="ml-1 text-muted-foreground">{row.unit}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.category || "—"}
                </TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                  {row.short_desc || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </StudioShell>
  )
}
