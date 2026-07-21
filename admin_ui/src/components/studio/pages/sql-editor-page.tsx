"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Play,
  Eraser,
  Wand2,
  Download,
  Clock3,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { useStudioPage } from "@/components/studio/studio-page-meta"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStudioConnection } from "@/hooks/use-studio-connection"
import { useProject } from "@/lib/platform/project-context"
import {
  clearSqlHistory,
  explainQuery,
  formatQuery,
  getEditorQuery,
  loadSqlHistory,
  pushSqlHistory,
  rowsToCsv,
  runQuery,
  type ExplainMode,
  type QueryResult,
  type SqlHistoryItem,
} from "@/lib/sql"

const DEFAULT_SQL = `select current_database() as database,
       current_user as "user",
       version() as version;`

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function SqlEditorPageClient() {
  const searchParams = useSearchParams()
  const { projectId } = useProject()
  const { connection, ready } = useStudioConnection()
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [running, setRunning] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [resultTab, setResultTab] = useState<"data" | "plan">("data")
  const [history, setHistory] = useState<SqlHistoryItem[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [snippetTitle, setSnippetTitle] = useState("")
  const [savingSnippet, setSavingSnippet] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const loadedSnippetRef = useRef<string | null>(null)

  useEffect(() => {
    setHistory(loadSqlHistory())
  }, [])

  useEffect(() => {
    const snippetId = searchParams.get("snippet")
    if (!snippetId || loadedSnippetRef.current === snippetId) return
    loadedSnippetRef.current = snippetId
    void (async () => {
      try {
        const res = await fetch(
          `/api/platform/projects/${projectId}/snippets/${snippetId}`,
          { cache: "no-store" }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load snippet")
        setSql(data.snippet.sql)
        setSnippetTitle(data.snippet.title)
        toast.success(`Loaded “${data.snippet.title}”`)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load snippet"
        )
      }
    })()
  }, [searchParams, projectId])

  const onRun = useCallback(async () => {
    if (!connection) return
    const query = getEditorQuery(editorRef.current, sql)
    if (!query) {
      toast.error("Enter a SQL statement to run")
      return
    }

    setRunning(true)
    setError(null)
    try {
      const data = await runQuery(query, connection)
      setResult(data)
      setResultTab("data")
      setHistory(
        pushSqlHistory({
          sql: query,
          ok: true,
          rowCount: data.rowCount,
          durationMs: data.durationMs,
        })
      )
      toast.success(`${data.rowCount} row(s) · ${data.durationMs}ms`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query failed"
      setResult(null)
      setError(message)
      setHistory(
        pushSqlHistory({
          sql: query,
          ok: false,
          error: message,
        })
      )
      toast.error(message)
    } finally {
      setRunning(false)
    }
  }, [connection, sql])

  const onExplain = useCallback(
    async (mode: ExplainMode) => {
      if (!connection) return
      const query = getEditorQuery(editorRef.current, sql)
      if (!query) {
        toast.error("Enter a SQL statement to explain")
        return
      }

      setRunning(true)
      setError(null)
      try {
        const data = await explainQuery(query, mode, connection)
        setPlan(data.plan)
        setResultTab("plan")
        setHistory(
          pushSqlHistory({
            sql: query,
            ok: true,
            durationMs: data.durationMs,
          })
        )
        toast.success(
          mode === "analyze"
            ? `Analyze plan · ${data.durationMs}ms`
            : `Explain plan · ${data.durationMs}ms`
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : "Explain failed"
        setPlan(null)
        setError(message)
        setHistory(
          pushSqlHistory({
            sql: query,
            ok: false,
            error: message,
          })
        )
        toast.error(message)
      } finally {
        setRunning(false)
      }
    },
    [connection, sql]
  )

  const onFormat = useCallback(async () => {
    if (!connection) return
    const query = sql.trim()
    if (!query) return

    setFormatting(true)
    try {
      const data = await formatQuery(query, connection)
      setSql(
        typeof data.formatted === "string" ? data.formatted : String(data.formatted)
      )
      toast.success("Formatted")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Format failed"
      toast.error(message)
    } finally {
      setFormatting(false)
    }
  }, [connection, sql])

  async function saveSnippet() {
    if (!sql.trim()) {
      toast.error("Enter SQL to save")
      return
    }
    const title = snippetTitle.trim() || "Untitled snippet"
    setSavingSnippet(true)
    try {
      const res = await fetch(`/api/platform/projects/${projectId}/snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sql: sql.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast.success(`Saved “${data.snippet.title}”`)
      setSaveOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingSnippet(false)
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        void onRun()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onRun])

  const previewColumns = useMemo(() => {
    if (!result?.columns.length) return []
    return result.columns
  }, [result])


  useStudioPage({
    title: "SQL Editor",
    subtitle: "Run queries against the connected database · Ctrl/⌘+Enter run · select text to run selection",
    contentVariant: "flush",
    toolbar: (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void onRun()} disabled={running}>
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onFormat()}
              disabled={formatting || running}
            >
              {formatting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              Format
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onExplain("explain")}
              disabled={running}
            >
              Explain
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onExplain("analyze")}
              disabled={running}
            >
              Analyze
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!snippetTitle) {
                  setSnippetTitle(
                    sql.trim().slice(0, 40).replace(/\s+/g, " ") ||
                      "Untitled snippet"
                  )
                }
                setSaveOpen(true)
              }}
            >
              <Save className="size-3.5" />
              Save snippet
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSql("")
                setResult(null)
                setPlan(null)
                setResultTab("data")
                setError(null)
                editorRef.current?.focus()
              }}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="sm" variant="outline" />}
              >
                <Clock3 className="size-3.5" />
                History
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Recent queries</DropdownMenuLabel>
                  {history.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No history yet
                    </div>
                  ) : (
                    history.slice(0, 12).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className="flex flex-col items-start gap-0.5"
                        onClick={() => setSql(item.sql)}
                      >
                        <span className="line-clamp-2 w-full font-mono text-[11px]">
                          {item.sql}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.ok
                            ? `${item.rowCount ?? 0} rows · ${item.durationMs ?? 0}ms`
                            : "failed"}{" "}
                          · {new Date(item.at).toLocaleString()}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuGroup>
                {history.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        clearSqlHistory()
                        setHistory([])
                      }}
                    >
                      Clear history
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {result ? (
              <>
                <Badge variant="secondary" className="font-normal">
                  {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {result.durationMs}ms
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!result.rows.length}
                  onClick={() => {
                    const csv = rowsToCsv(result.columns, result.rows)
                    const blob = new Blob([csv], {
                      type: "text/csv;charset=utf-8",
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `query-${Date.now()}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </>
            ) : null}
          </div>
        </>
    ),
  })

  return (
    <>
      <div className="flex min-h-[70vh] flex-col">
        <div className="border-b border-border p-3">
          <Textarea
            ref={editorRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            className="min-h-[200px] resize-y font-mono text-sm leading-relaxed"
            placeholder="Write SQL here…"
          />
        </div>

        <div className="flex flex-1 flex-col overflow-auto">
          {error ? (
            <div className="p-3">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {result || plan ? (
            <div className="border-b border-border px-3 py-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <Button
                  size="xs"
                  variant={resultTab === "data" ? "default" : "ghost"}
                  onClick={() => setResultTab("data")}
                >
                  Data
                </Button>
                <Button
                  size="xs"
                  variant={resultTab === "plan" ? "default" : "ghost"}
                  onClick={() => setResultTab("plan")}
                  disabled={!plan}
                >
                  Plan
                </Button>
              </div>
            </div>
          ) : null}

          {resultTab === "data" ? (
            <>
              {!error && !result ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                  {plan
                    ? "No data results · switch to Plan or run a query"
                    : "Run a query to see results here"}
                </div>
              ) : null}

              {result && result.rowCount === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                  Query succeeded · 0 rows returned
                </div>
              ) : null}

              {result && result.rowCount > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {previewColumns.map((col) => (
                        <TableHead key={col} className="font-mono text-xs">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i}>
                        {previewColumns.map((col) => {
                          const value = row[col]
                          const isNull = value === null || value === undefined
                          return (
                            <TableCell
                              key={col}
                              className={
                                isNull
                                  ? "font-mono text-xs text-muted-foreground italic"
                                  : "max-w-[280px] truncate font-mono text-xs"
                              }
                              title={cellValue(value)}
                            >
                              {cellValue(value)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </>
          ) : plan ? (
            <div className="p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {plan}
              </pre>
            </div>
          ) : null}
        </div>
      </div>

    <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save SQL snippet</DialogTitle>
          <DialogDescription>
            Store this query on the project for reuse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="snippet-title">Title</Label>
          <Input
            id="snippet-title"
            value={snippetTitle}
            onChange={(e) => setSnippetTitle(e.target.value)}
            placeholder="My query"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveSnippet()} disabled={savingSnippet}>
            {savingSnippet ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
