import type { DbConnectionConfig } from "@/lib/connection"

export type QueryResult = {
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  durationMs: number
}

export type FormatResult = {
  formatted: string
}

export type ExplainMode = "explain" | "analyze"

async function postQueryApi<T>(body: {
  query: string
  action?: "run" | "format"
  parameters?: unknown[]
}): Promise<T> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Request failed (${res.status})`
    )
  }
  return data as T
}

export function runQuery(
  query: string,
  _connection?: DbConnectionConfig | null,
  parameters?: unknown[]
) {
  return postQueryApi<QueryResult>({ query, action: "run", parameters })
}

export function formatQuery(
  query: string,
  _connection?: DbConnectionConfig | null
) {
  return postQueryApi<FormatResult>({ query, action: "format" })
}

/** Wrap SQL in EXPLAIN / EXPLAIN ANALYZE and return textual plan. */
export async function explainQuery(
  query: string,
  mode: ExplainMode = "explain",
  _connection?: DbConnectionConfig | null
): Promise<{ plan: string; durationMs: number; result: QueryResult }> {
  const trimmed = query.trim().replace(/;$/, "")
  const prefix =
    mode === "analyze"
      ? "EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)"
      : "EXPLAIN (VERBOSE, FORMAT TEXT)"
  const result = await runQuery(`${prefix}\n${trimmed}`, _connection)
  const plan = result.rows
    .map((row) => {
      const key = Object.keys(row)[0]
      return key ? String(row[key] ?? "") : ""
    })
    .filter(Boolean)
    .join("\n")
  return { plan, durationMs: result.durationMs, result }
}

/** Prefer selected text in a textarea; otherwise full value. */
export function getEditorQuery(
  el: HTMLTextAreaElement | null,
  fullSql: string
): string {
  if (!el) return fullSql.trim()
  const { selectionStart, selectionEnd, value } = el
  if (
    selectionStart !== selectionEnd &&
    selectionStart != null &&
    selectionEnd != null
  ) {
    return value.slice(selectionStart, selectionEnd).trim()
  }
  return fullSql.trim()
}

const HISTORY_KEY = "pgadmin.sql.history"
const MAX_HISTORY = 30

export type SqlHistoryItem = {
  id: string
  sql: string
  at: string
  ok: boolean
  rowCount?: number
  durationMs?: number
  error?: string
}

export function loadSqlHistory(): SqlHistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SqlHistoryItem[]
  } catch {
    return []
  }
}

export function pushSqlHistory(item: Omit<SqlHistoryItem, "id" | "at">) {
  const next: SqlHistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  }
  const history = [next, ...loadSqlHistory()].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export function clearSqlHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function rowsToCsv(
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ""
    const str =
      typeof value === "object" ? JSON.stringify(value) : String(value)
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = columns.map(escape).join(",")
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(","))
  return [header, ...body].join("\n")
}

export function parseCsv(text: string): {
  columns: string[]
  rows: Record<string, string>[]
} {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length)
  if (!lines.length) return { columns: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        cells.push(cur)
        cur = ""
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    return cells
  }

  const columns = parseLine(lines[0]).map((c) => c.trim() || "column")
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const row: Record<string, string> = {}
    columns.forEach((col, i) => {
      row[col] = cells[i] ?? ""
    })
    return row
  })
  return { columns, rows }
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function buildCsvInsertSql(
  schema: string,
  table: string,
  columns: string[],
  rows: Record<string, string>[],
  nullTokens: string[] = ["", "NULL", "null"]
): string {
  if (!columns.length || !rows.length) return ""
  const tableRef = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const cols = columns.map(quoteIdent).join(", ")
  const valueRows = rows.map((row) => {
    const vals = columns.map((col) => {
      const raw = row[col]
      if (raw == null || nullTokens.includes(raw)) return "NULL"
      return `'${String(raw).replace(/'/g, "''")}'`
    })
    return `(${vals.join(", ")})`
  })
  const chunkSize = 100
  const statements: string[] = []
  for (let i = 0; i < valueRows.length; i += chunkSize) {
    const chunk = valueRows.slice(i, i + chunkSize)
    statements.push(
      `INSERT INTO ${tableRef} (${cols}) VALUES\n${chunk.join(",\n")};`
    )
  }
  return statements.join("\n\n")
}
