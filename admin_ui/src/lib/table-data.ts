import type { DbConnectionConfig } from "@/lib/connection"
import { runQuery, type QueryResult } from "@/lib/sql"
import type { PostgresColumn, PostgresTable } from "@/lib/types"
import { fetchMeta } from "@/lib/client-meta"

/** Quote a Postgres identifier safely. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export function qualifyTable(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`
}

export type SortDir = "asc" | "desc"

export type TableBrowseParams = {
  schema: string
  table: string
  columns: PostgresColumn[]
  limit: number
  offset: number
  sortColumn?: string | null
  sortDir?: SortDir
  filter?: string
}

export async function fetchTableMeta(
  schema: string,
  name: string,
  connection: DbConnectionConfig
): Promise<PostgresTable> {
  const tables = await fetchMeta<PostgresTable[]>(
    `tables?include_system_schemas=true&include_columns=true&included_schemas=${encodeURIComponent(schema)}`,
    connection
  )
  const table = tables.find((t) => t.schema === schema && t.name === name)
  if (!table) {
    throw new Error(`Table ${schema}.${name} not found`)
  }
  return table
}

export async function countTableRows(
  params: Pick<TableBrowseParams, "schema" | "table" | "columns" | "filter">,
  connection: DbConnectionConfig
): Promise<number> {
  const { sql, parameters } = buildCountSql(params)
  const result = await runQuery(sql, connection, parameters)
  const raw = result.rows[0]?.count
  return typeof raw === "number" ? raw : Number(raw || 0)
}

export async function browseTableRows(
  params: TableBrowseParams,
  connection: DbConnectionConfig
): Promise<QueryResult & { total: number }> {
  const total = await countTableRows(params, connection)
  const { sql, parameters } = buildSelectSql(params)
  const result = await runQuery(sql, connection, parameters)
  return { ...result, total }
}

function buildFilterClause(
  columns: PostgresColumn[],
  filter: string | undefined,
  startIndex = 1
): { clause: string; parameters: unknown[]; nextIndex: number } {
  const q = filter?.trim()
  if (!q || columns.length === 0) {
    return { clause: "", parameters: [], nextIndex: startIndex }
  }

  const textCols = columns.filter((c) => {
    const t = (c.format || c.data_type || "").toLowerCase()
    return (
      t.includes("char") ||
      t.includes("text") ||
      t.includes("uuid") ||
      t.includes("name") ||
      t === "json" ||
      t === "jsonb"
    )
  })
  const cols = textCols.length ? textCols : columns.slice(0, 8)
  const parts = cols.map(
    (c, i) =>
      `cast(${quoteIdent(c.name)} as text) ilike $${startIndex + i}`
  )
  return {
    clause: ` where (${parts.join(" or ")})`,
    parameters: cols.map(() => `%${q}%`),
    nextIndex: startIndex + cols.length,
  }
}

export function buildCountSql(
  params: Pick<TableBrowseParams, "schema" | "table" | "columns" | "filter">
): { sql: string; parameters: unknown[] } {
  const rel = qualifyTable(params.schema, params.table)
  const { clause, parameters } = buildFilterClause(params.columns, params.filter)
  return {
    sql: `select count(*)::int as count from ${rel}${clause}`,
    parameters,
  }
}

export function buildSelectSql(params: TableBrowseParams): {
  sql: string
  parameters: unknown[]
} {
  const rel = qualifyTable(params.schema, params.table)
  const { clause, parameters, nextIndex } = buildFilterClause(
    params.columns,
    params.filter
  )

  let order = ""
  if (params.sortColumn) {
    const allowed = params.columns.some((c) => c.name === params.sortColumn)
    if (allowed) {
      order = ` order by ${quoteIdent(params.sortColumn)} ${
        params.sortDir === "desc" ? "desc" : "asc"
      } nulls last`
    }
  }

  const limitIdx = nextIndex
  const offsetIdx = nextIndex + 1
  const sql = `select * from ${rel}${clause}${order} limit $${limitIdx} offset $${offsetIdx}`
  return {
    sql,
    parameters: [...parameters, params.limit, params.offset],
  }
}

export function getPrimaryKeyColumns(table: PostgresTable): string[] {
  return (table.primary_keys || []).map((pk) => pk.name)
}

export function buildUpdateSql(opts: {
  schema: string
  table: string
  pkColumns: string[]
  pkValues: Record<string, unknown>
  changes: Record<string, unknown>
}): { sql: string; parameters: unknown[] } {
  const setKeys = Object.keys(opts.changes)
  if (!setKeys.length) throw new Error("No changes to save")
  if (!opts.pkColumns.length) {
    throw new Error("Table has no primary key — cannot update rows safely")
  }

  const parameters: unknown[] = []
  const setParts = setKeys.map((key, i) => {
    parameters.push(opts.changes[key])
    return `${quoteIdent(key)} = $${i + 1}`
  })

  const whereParts = opts.pkColumns.map((key) => {
    parameters.push(opts.pkValues[key])
    return `${quoteIdent(key)} = $${parameters.length}`
  })

  const rel = qualifyTable(opts.schema, opts.table)
  return {
    sql: `update ${rel} set ${setParts.join(", ")} where ${whereParts.join(" and ")} returning *`,
    parameters,
  }
}

export function buildInsertSql(opts: {
  schema: string
  table: string
  values: Record<string, unknown>
}): { sql: string; parameters: unknown[] } {
  const keys = Object.keys(opts.values)
  if (!keys.length) throw new Error("No values to insert")

  const rel = qualifyTable(opts.schema, opts.table)
  const cols = keys.map(quoteIdent).join(", ")
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
  return {
    sql: `insert into ${rel} (${cols}) values (${placeholders}) returning *`,
    parameters: keys.map((k) => opts.values[k]),
  }
}

export function buildDeleteSql(opts: {
  schema: string
  table: string
  pkColumns: string[]
  pkValues: Record<string, unknown>
}): { sql: string; parameters: unknown[] } {
  if (!opts.pkColumns.length) {
    throw new Error("Table has no primary key — cannot delete rows safely")
  }
  const parameters: unknown[] = []
  const whereParts = opts.pkColumns.map((key) => {
    parameters.push(opts.pkValues[key])
    return `${quoteIdent(key)} = $${parameters.length}`
  })
  const rel = qualifyTable(opts.schema, opts.table)
  return {
    sql: `delete from ${rel} where ${whereParts.join(" and ")}`,
    parameters,
  }
}

export function editableColumns(columns: PostgresColumn[]): PostgresColumn[] {
  return columns.filter((c) => !c.is_generated && c.is_updatable !== false)
}

export function valueToInput(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function inputToValue(
  raw: string,
  column: PostgresColumn,
  asNull: boolean
): unknown {
  if (asNull) return null
  if (raw === "") {
    if (column.is_nullable) return null
    return ""
  }

  const format = (column.format || column.data_type || "").toLowerCase()
  if (
    format.includes("int") ||
    format === "numeric" ||
    format === "decimal" ||
    format === "real" ||
    format === "double precision" ||
    format === "float4" ||
    format === "float8"
  ) {
    const n = Number(raw)
    if (Number.isNaN(n)) throw new Error(`Invalid number for ${column.name}`)
    return n
  }
  if (format === "bool" || format === "boolean") {
    if (["true", "t", "1", "yes"].includes(raw.toLowerCase())) return true
    if (["false", "f", "0", "no"].includes(raw.toLowerCase())) return false
    throw new Error(`Invalid boolean for ${column.name}`)
  }
  if (format === "json" || format === "jsonb") {
    return JSON.parse(raw)
  }
  return raw
}
