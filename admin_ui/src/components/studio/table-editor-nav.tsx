"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Eye, Loader2, Plus, Table2 } from "lucide-react"
import { fetchMeta } from "@/lib/client-meta"
import { studioPath } from "@/lib/platform/paths"
import type { PostgresSchema, PostgresTable, PostgresView } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"

type TableEditorNavProps = {
  projectId: string
  filter: string
  onFilterChange: (value: string) => void
  onCreateTable?: () => void
}

export function TableEditorNav({
  projectId,
  filter,
  onFilterChange,
  onCreateTable,
}: TableEditorNavProps) {
  const pathname = usePathname()
  const [schemas, setSchemas] = useState<PostgresSchema[]>([])
  const [tables, setTables] = useState<PostgresTable[]>([])
  const [views, setViews] = useState<PostgresView[]>([])
  const [schema, setSchema] = useState("public")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schemaList, tableList, viewList] = await Promise.all([
        fetchMeta<PostgresSchema[]>("schemas?include_system_schemas=false"),
        fetchMeta<PostgresTable[]>(
          "tables?include_system_schemas=false&include_columns=false"
        ),
        fetchMeta<PostgresView[]>(
          "views?include_system_schemas=false&include_columns=false"
        ),
      ])
      setSchemas(schemaList)
      setTables(tableList)
      setViews(viewList)
      if (
        schemaList.length &&
        !schemaList.some((s) => s.name === schema)
      ) {
        setSchema(schemaList[0].name)
      }
    } catch {
      setSchemas([])
      setTables([])
      setViews([])
    } finally {
      setLoading(false)
    }
  }, [schema])

  useEffect(() => {
    void load()
  }, [load])

  // Sync schema from URL when viewing a table
  useEffect(() => {
    const match = pathname.match(/\/tables\/([^/]+)\//)
    if (match?.[1]) {
      setSchema(decodeURIComponent(match[1]))
    }
  }, [pathname])

  const q = filter.trim().toLowerCase()
  const filteredTables = tables
    .filter((t) => t.schema === schema)
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  const filteredViews = views
    .filter((v) => v.schema === schema)
    .filter((v) => !q || v.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-sidebar-border p-2">
        <select
          className={selectClass}
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
        >
          {schemas.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        {onCreateTable ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full justify-start"
            onClick={onCreateTable}
          >
            <Plus className="size-3.5" />
            New table
          </Button>
        ) : null}
        <div className="relative">
          <Input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search for a table"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                All tables
              </p>
              {!filteredTables.length ? (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">
                  No tables
                </p>
              ) : (
                filteredTables.map((t) => {
                  const href = studioPath(
                    projectId,
                    `/tables/${encodeURIComponent(t.schema)}/${encodeURIComponent(t.name)}`
                  )
                  const active =
                    pathname === href || pathname.startsWith(`${href}`)
                  return (
                    <Link
                      key={t.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <Table2
                        className={cn(
                          "size-3.5 shrink-0",
                          active && "text-primary"
                        )}
                      />
                      <span className="truncate">{t.name}</span>
                    </Link>
                  )
                })
              )}
            </div>

            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                All views
              </p>
              {!filteredViews.length ? (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">
                  No views
                </p>
              ) : (
                filteredViews.map((v) => {
                  const href = studioPath(projectId, "/views")
                  return (
                    <Link
                      key={v.id}
                      href={href}
                      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
                      title={`${v.schema}.${v.name}`}
                    >
                      <Eye className="size-3.5 shrink-0" />
                      <span className="truncate">{v.name}</span>
                    </Link>
                  )
                })
              )}
            </div>

            <div className="border-t border-sidebar-border pt-2">
              <Link
                href={studioPath(projectId, "/tables")}
                className="block rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              >
                Browse all tables…
              </Link>
              <Link
                href={studioPath(projectId, "/foreign-tables")}
                className="block rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              >
                Foreign tables…
              </Link>
            </div>
          </>
        )}
      </nav>
    </div>
  )
}
