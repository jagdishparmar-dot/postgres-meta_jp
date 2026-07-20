import { runQuery, type QueryResult } from "@/lib/sql"

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export type ActivityRow = {
  pid: number
  usename: string | null
  application_name: string | null
  client_addr: string | null
  state: string | null
  wait_event_type: string | null
  wait_event: string | null
  duration: string | null
  query: string | null
}

export type LockRow = {
  pid: number
  usename: string | null
  locktype: string
  mode: string
  granted: boolean
  relation: string | null
  query: string | null
}

export type TableSizeRow = {
  schema: string
  name: string
  total_size: string
  total_bytes: number
  table_size: string
  index_size: string
  live_rows: number
  dead_rows: number
  dead_pct: number
  last_vacuum: string | null
  last_autovacuum: string | null
  last_analyze: string | null
  last_autoanalyze: string | null
}

export type SlowQueryRow = {
  query: string
  calls: number
  total_ms: number
  mean_ms: number
  rows: number
}

const ACTIVITY_SQL = `
SELECT
  pid,
  usename,
  application_name,
  client_addr::text AS client_addr,
  state,
  wait_event_type,
  wait_event,
  (now() - query_start)::text AS duration,
  left(query, 300) AS query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = current_database()
ORDER BY query_start NULLS LAST
`

const LOCKS_SQL = `
SELECT
  a.pid,
  a.usename,
  l.locktype,
  l.mode,
  l.granted,
  COALESCE(n.nspname || '.' || c.relname, l.relation::text) AS relation,
  left(a.query, 200) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
LEFT JOIN pg_class c ON c.oid = l.relation
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE a.datname = current_database()
  AND a.pid <> pg_backend_pid()
ORDER BY l.granted, a.pid
`

const TABLE_SIZES_SQL = `
SELECT
  n.nspname AS schema,
  c.relname AS name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_total_relation_size(c.oid)::float8 AS total_bytes,
  pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
  COALESCE(s.n_live_tup, 0)::float8 AS live_rows,
  COALESCE(s.n_dead_tup, 0)::float8 AS dead_rows,
  CASE
    WHEN COALESCE(s.n_live_tup, 0) + COALESCE(s.n_dead_tup, 0) > 0
    THEN round(
      100.0 * s.n_dead_tup / NULLIF(s.n_live_tup + s.n_dead_tup, 0),
      1
    )::float8
    ELSE 0::float8
  END AS dead_pct,
  s.last_vacuum::text,
  s.last_autovacuum::text,
  s.last_analyze::text,
  s.last_autoanalyze::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp_%'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 200
`

export async function fetchActivity(): Promise<{
  activity: ActivityRow[]
  locks: LockRow[]
}> {
  const [activityRes, locksRes] = await Promise.all([
    runQuery(ACTIVITY_SQL),
    runQuery(LOCKS_SQL),
  ])
  return {
    activity: activityRes.rows as unknown as ActivityRow[],
    locks: locksRes.rows as unknown as LockRow[],
  }
}

export async function cancelBackend(pid: number): Promise<boolean> {
  const res = await runQuery(`SELECT pg_cancel_backend($1) AS ok`, null, [pid])
  return Boolean(res.rows[0]?.ok)
}

export async function terminateBackend(pid: number): Promise<boolean> {
  const res = await runQuery(`SELECT pg_terminate_backend($1) AS ok`, null, [
    pid,
  ])
  return Boolean(res.rows[0]?.ok)
}

export async function fetchTableSizes(): Promise<TableSizeRow[]> {
  const res = await runQuery(TABLE_SIZES_SQL)
  return res.rows.map((row) => ({
    schema: String(row.schema),
    name: String(row.name),
    total_size: String(row.total_size),
    total_bytes: Number(row.total_bytes || 0),
    table_size: String(row.table_size),
    index_size: String(row.index_size),
    live_rows: Number(row.live_rows || 0),
    dead_rows: Number(row.dead_rows || 0),
    dead_pct: Number(row.dead_pct || 0),
    last_vacuum: row.last_vacuum == null ? null : String(row.last_vacuum),
    last_autovacuum:
      row.last_autovacuum == null ? null : String(row.last_autovacuum),
    last_analyze: row.last_analyze == null ? null : String(row.last_analyze),
    last_autoanalyze:
      row.last_autoanalyze == null ? null : String(row.last_autoanalyze),
  }))
}

export async function isPgStatStatementsInstalled(): Promise<boolean> {
  const res = await runQuery(
    `SELECT EXISTS (
       SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
     ) AS installed`
  )
  return Boolean(res.rows[0]?.installed)
}

export async function fetchSlowQueries(
  limit = 50
): Promise<{ rows: SlowQueryRow[]; error?: string }> {
  const installed = await isPgStatStatementsInstalled()
  if (!installed) {
    return {
      rows: [],
      error:
        "Extension pg_stat_statements is not installed. Run CREATE EXTENSION pg_stat_statements; (requires shared_preload_libraries).",
    }
  }

  // PG13+ uses *_exec_time; older versions use total_time / mean_time
  try {
    const res = await runQuery(`
SELECT
  left(query, 280) AS query,
  calls::float8 AS calls,
  round(total_exec_time::numeric, 1)::float8 AS total_ms,
  round(mean_exec_time::numeric, 2)::float8 AS mean_ms,
  rows::float8 AS rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY mean_exec_time DESC
LIMIT ${Math.min(Math.max(limit, 1), 200)}
`)
    return {
      rows: res.rows.map((r) => ({
        query: String(r.query || ""),
        calls: Number(r.calls || 0),
        total_ms: Number(r.total_ms || 0),
        mean_ms: Number(r.mean_ms || 0),
        rows: Number(r.rows || 0),
      })),
    }
  } catch {
    const res = await runQuery(`
SELECT
  left(query, 280) AS query,
  calls::float8 AS calls,
  round(total_time::numeric, 1)::float8 AS total_ms,
  round(mean_time::numeric, 2)::float8 AS mean_ms,
  rows::float8 AS rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT ${Math.min(Math.max(limit, 1), 200)}
`)
    return {
      rows: res.rows.map((r) => ({
        query: String(r.query || ""),
        calls: Number(r.calls || 0),
        total_ms: Number(r.total_ms || 0),
        mean_ms: Number(r.mean_ms || 0),
        rows: Number(r.rows || 0),
      })),
    }
  }
}

export type MaintenanceAction = "vacuum" | "analyze" | "vacuum_analyze"

export async function runMaintenance(
  schema: string,
  table: string,
  action: MaintenanceAction
): Promise<QueryResult> {
  const target = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const sql =
    action === "vacuum"
      ? `VACUUM ${target}`
      : action === "analyze"
        ? `ANALYZE ${target}`
        : `VACUUM ANALYZE ${target}`
  return runQuery(sql)
}
