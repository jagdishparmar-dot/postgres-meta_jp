import { NextRequest, NextResponse } from "next/server"
import { resolveConnectionString } from "@/lib/connection-session"
import { Client } from "pg"

export const runtime = "nodejs"

type Body = {
  include_data?: boolean
  schema_only?: boolean
}

const MAX_ROWS_PER_TABLE = 1000

function qIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

export async function POST(request: NextRequest) {
  try {
    const connectionString = await resolveConnectionString(request)
    if (!connectionString) {
      return NextResponse.json(
        { error: "No active project connection." },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as Body
    const includeData = Boolean(body.include_data) && !body.schema_only

    const client = new Client({ connectionString })
    await client.connect()
    try {
      const parts: string[] = [
        `-- Logical backup generated ${new Date().toISOString()}`,
        `-- Database: ${(await client.query(`SELECT current_database() AS d`)).rows[0]?.d}`,
        "",
      ]

      const schemas = await client.query<{ nspname: string }>(
        `SELECT nspname FROM pg_namespace
         WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast')
           AND nspname NOT LIKE 'pg_temp%'
           AND nspname NOT LIKE 'pg_toast_temp%'
         ORDER BY nspname`
      )

      for (const { nspname } of schemas.rows) {
        parts.push(`CREATE SCHEMA IF NOT EXISTS ${qIdent(nspname)};`)
      }
      parts.push("")

      const tables = await client.query<{
        schema: string
        name: string
      }>(
        `SELECT n.nspname AS schema, c.relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
           AND n.nspname NOT LIKE 'pg_temp%'
         ORDER BY n.nspname, c.relname`
      )

      for (const table of tables.rows) {
        const cols = await client.query<{
          column_name: string
          data_type: string
          udt_name: string
          is_nullable: string
          column_default: string | null
        }>(
          `SELECT column_name, data_type, udt_name, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [table.schema, table.name]
        )

        if (!cols.rows.length) continue

        const colDefs = cols.rows.map((c) => {
          let typ = c.data_type
          if (c.data_type === "USER-DEFINED") typ = c.udt_name
          if (c.data_type === "ARRAY") typ = `${c.udt_name.replace(/^_/, "")}[]`
          const nullSql = c.is_nullable === "YES" ? "" : " NOT NULL"
          const defSql = c.column_default
            ? ` DEFAULT ${c.column_default}`
            : ""
          return `  ${qIdent(c.column_name)} ${typ}${nullSql}${defSql}`
        })

        const full = `${qIdent(table.schema)}.${qIdent(table.name)}`
        parts.push(`-- ${table.schema}.${table.name}`)
        parts.push(`DROP TABLE IF EXISTS ${full} CASCADE;`)
        parts.push(`CREATE TABLE ${full} (`)
        parts.push(colDefs.join(",\n"))
        parts.push(`);`)
        parts.push("")

        if (includeData) {
          const data = await client.query(
            `SELECT * FROM ${full} LIMIT ${MAX_ROWS_PER_TABLE}`
          )
          if (data.rows.length) {
            const names = data.fields.map((f) => qIdent(f.name))
            const valueLines = data.rows.map((row) => {
              const vals = data.fields.map((f) => sqlLiteral(row[f.name]))
              return `  (${vals.join(", ")})`
            })
            parts.push(
              `INSERT INTO ${full} (${names.join(", ")}) VALUES\n${valueLines.join(",\n")};`
            )
            if (data.rows.length >= MAX_ROWS_PER_TABLE) {
              parts.push(
                `-- NOTE: truncated to ${MAX_ROWS_PER_TABLE} rows for ${table.schema}.${table.name}`
              )
            }
            parts.push("")
          }
        }
      }

      return NextResponse.json({
        sql: parts.join("\n"),
        tableCount: tables.rows.length,
        includeData,
      })
    } finally {
      await client.end()
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backup failed",
      },
      { status: 500 }
    )
  }
}
