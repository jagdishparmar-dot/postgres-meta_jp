"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Columns3,
  Eye,
  FunctionSquare,
  Layers,
  Loader2,
  Search,
  Table2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  filterCatalogSearch,
  loadCatalogSearchIndex,
  type CatalogSearchItem,
  type CatalogSearchKind,
} from "@/lib/catalog-search"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<CatalogSearchKind, typeof Table2> = {
  schema: Layers,
  table: Table2,
  column: Columns3,
  view: Eye,
  function: FunctionSquare,
}

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export function GlobalSearch({ open, onOpenChange, projectId }: GlobalSearchProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<CatalogSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(
    () => filterCatalogSearch(items, query),
    [items, query]
  )

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
    setError(null)
    setLoading(true)
    void loadCatalogSearchIndex(projectId)
      .then(setItems)
      .catch((err) => {
        setItems([])
        setError(err instanceof Error ? err.message : "Failed to load catalog")
      })
      .finally(() => setLoading(false))
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, projectId])

  useEffect(() => {
    setActive(0)
  }, [query])

  const go = useCallback(
    (item: CatalogSearchItem) => {
      onOpenChange(false)
      router.push(item.href)
    },
    [onOpenChange, router]
  )

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault()
      go(results[active])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search catalog</DialogTitle>
          <DialogDescription>
            Search tables, columns, views, and functions
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tables, columns, functions…"
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(420px,55vh)] overflow-y-auto p-1.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Indexing catalog…
            </div>
          ) : error ? (
            <p className="px-3 py-8 text-center text-sm text-destructive">
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((item, index) => {
                const Icon = KIND_ICON[item.kind]
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                        index === active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/60"
                      )}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(item)}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.kind}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useGlobalSearchHotkey(
  onOpen: () => void
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onOpen])
}
