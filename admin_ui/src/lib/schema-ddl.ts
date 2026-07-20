import type { DbConnectionConfig } from "@/lib/connection"
import {
  deleteMeta,
  fetchMeta,
  patchMeta,
  postMeta,
} from "@/lib/client-meta"
import type { PostgresColumn, PostgresSchema, PostgresTable } from "@/lib/types"

export const COMMON_COLUMN_TYPES = [
  "int4",
  "int8",
  "text",
  "varchar",
  "bool",
  "timestamptz",
  "timestamp",
  "date",
  "uuid",
  "jsonb",
  "json",
  "numeric",
  "float8",
  "bytea",
] as const

export type ColumnDraft = {
  name: string
  type: string
  is_nullable: boolean
  is_unique: boolean
  is_primary_key: boolean
  is_identity: boolean
  default_value: string
  comment: string
}

export function emptyColumnDraft(): ColumnDraft {
  return {
    name: "",
    type: "text",
    is_nullable: true,
    is_unique: false,
    is_primary_key: false,
    is_identity: false,
    default_value: "",
    comment: "",
  }
}

export async function listSchemas(
  connection: DbConnectionConfig
): Promise<PostgresSchema[]> {
  return fetchMeta<PostgresSchema[]>(
    "schemas?include_system_schemas=false",
    connection
  )
}

export async function createTableWithColumns(
  opts: {
    name: string
    schema: string
    comment?: string
    columns: ColumnDraft[]
  },
  connection: DbConnectionConfig
): Promise<PostgresTable> {
  const table = await postMeta<PostgresTable>(
    "tables",
    {
      name: opts.name,
      schema: opts.schema || "public",
      comment: opts.comment || undefined,
    },
    connection
  )

  for (const col of opts.columns) {
    if (!col.name.trim()) continue
    await postMeta(
      "columns",
      {
        table_id: table.id,
        name: col.name.trim(),
        type: col.type,
        is_nullable: col.is_identity ? false : col.is_nullable,
        is_unique: col.is_unique,
        is_primary_key: col.is_primary_key,
        is_identity: col.is_identity || undefined,
        identity_generation: col.is_identity ? "BY DEFAULT" : undefined,
        default_value: col.default_value.trim()
          ? col.default_value.trim()
          : undefined,
        default_value_format: col.default_value.trim() ? "expression" : undefined,
        comment: col.comment.trim() || undefined,
      },
      connection
    )
  }

  const refreshed = await fetchMeta<PostgresTable[]>(
    `tables?include_system_schemas=true&include_columns=true&included_schemas=${encodeURIComponent(table.schema)}`,
    connection
  )
  return refreshed.find((t) => t.id === table.id) || table
}

export async function renameTable(
  id: number,
  name: string,
  connection: DbConnectionConfig
) {
  return patchMeta<PostgresTable>("tables/" + id, { name }, connection)
}

export async function dropTable(
  id: number,
  connection: DbConnectionConfig,
  cascade = true
) {
  return deleteMeta<PostgresTable>(
    `tables/${id}?cascade=${cascade}`,
    connection
  )
}

export async function addColumn(
  tableId: number,
  col: ColumnDraft,
  connection: DbConnectionConfig
) {
  return postMeta<PostgresColumn>(
    "columns",
    {
      table_id: tableId,
      name: col.name.trim(),
      type: col.type,
      is_nullable: col.is_identity ? false : col.is_nullable,
      is_unique: col.is_unique,
      is_primary_key: col.is_primary_key,
      is_identity: col.is_identity || undefined,
      identity_generation: col.is_identity ? "BY DEFAULT" : undefined,
      default_value: col.default_value.trim()
        ? col.default_value.trim()
        : undefined,
      default_value_format: col.default_value.trim() ? "expression" : undefined,
      comment: col.comment.trim() || undefined,
    },
    connection
  )
}

export async function updateColumn(
  columnId: string,
  patch: {
    name?: string
    type?: string
    is_nullable?: boolean
    is_unique?: boolean
    default_value?: string | null
    drop_default?: boolean
    comment?: string
  },
  connection: DbConnectionConfig
) {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.type !== undefined) body.type = patch.type
  if (patch.is_nullable !== undefined) body.is_nullable = patch.is_nullable
  if (patch.is_unique !== undefined) body.is_unique = patch.is_unique
  if (patch.comment !== undefined) body.comment = patch.comment
  if (patch.drop_default) body.drop_default = true
  else if (patch.default_value !== undefined) {
    if (patch.default_value === null || patch.default_value === "") {
      body.drop_default = true
    } else {
      body.default_value = patch.default_value
      body.default_value_format = "expression"
    }
  }
  return patchMeta<PostgresColumn>(`columns/${columnId}`, body, connection)
}

export async function dropColumn(
  columnId: string,
  connection: DbConnectionConfig,
  cascade = true
) {
  return deleteMeta<PostgresColumn>(
    `columns/${columnId}?cascade=${cascade}`,
    connection
  )
}

export async function setPrimaryKeys(
  tableId: number,
  columnNames: string[],
  connection: DbConnectionConfig
) {
  return patchMeta<PostgresTable>(
    `tables/${tableId}`,
    { primary_keys: columnNames.map((name) => ({ name })) },
    connection
  )
}

export type ForeignKeyDraft = {
  name?: string
  columns: string[]
  referencedSchema: string
  referencedTable: string
  referencedColumns: string[]
  onDelete?: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT"
  onUpdate?: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT"
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export async function addForeignKey(
  table: Pick<PostgresTable, "schema" | "name">,
  draft: ForeignKeyDraft,
  connection: DbConnectionConfig
) {
  const { runQuery } = await import("@/lib/sql")
  const constraint =
    draft.name?.trim() ||
    `${table.name}_${draft.columns.join("_")}_fkey`
  const onDelete = draft.onDelete && draft.onDelete !== "NO ACTION"
    ? ` ON DELETE ${draft.onDelete}`
    : ""
  const onUpdate = draft.onUpdate && draft.onUpdate !== "NO ACTION"
    ? ` ON UPDATE ${draft.onUpdate}`
    : ""
  const sql = `ALTER TABLE ${quoteIdent(table.schema)}.${quoteIdent(table.name)}
  ADD CONSTRAINT ${quoteIdent(constraint)}
  FOREIGN KEY (${draft.columns.map(quoteIdent).join(", ")})
  REFERENCES ${quoteIdent(draft.referencedSchema)}.${quoteIdent(draft.referencedTable)}
  (${draft.referencedColumns.map(quoteIdent).join(", ")})${onDelete}${onUpdate};`
  await runQuery(sql, connection)
  return constraint
}

export async function dropForeignKey(
  table: Pick<PostgresTable, "schema" | "name">,
  constraintName: string,
  connection: DbConnectionConfig
) {
  const { runQuery } = await import("@/lib/sql")
  const sql = `ALTER TABLE ${quoteIdent(table.schema)}.${quoteIdent(table.name)}
  DROP CONSTRAINT ${quoteIdent(constraintName)};`
  await runQuery(sql, connection)
}

export async function createSchema(
  input: { name: string; owner?: string },
  connection: DbConnectionConfig
) {
  return postMeta<PostgresSchema>(
    "schemas",
    { name: input.name.trim(), owner: input.owner?.trim() || undefined },
    connection
  )
}

export async function updateSchema(
  id: number,
  patch: { name?: string; owner?: string },
  connection: DbConnectionConfig
) {
  return patchMeta<PostgresSchema>(`schemas/${id}`, patch, connection)
}

export async function dropSchema(
  id: number,
  connection: DbConnectionConfig,
  cascade = true
) {
  return deleteMeta<PostgresSchema>(
    `schemas/${id}?cascade=${cascade}`,
    connection
  )
}

export async function createFunction(
  input: {
    name: string
    schema?: string
    args?: string[]
    definition: string
    return_type?: string
    language?: string
    behavior?: string
    security_definer?: boolean
  },
  connection: DbConnectionConfig
) {
  return postMeta("functions", input, connection)
}

export async function updateFunction(
  id: number,
  patch: { name?: string; schema?: string; definition?: string },
  connection: DbConnectionConfig
) {
  return patchMeta(`functions/${id}`, patch, connection)
}

export async function dropFunction(
  id: number,
  connection: DbConnectionConfig,
  cascade = true
) {
  return deleteMeta(`functions/${id}?cascade=${cascade}`, connection)
}

export async function createOrReplaceView(
  input: { schema: string; name: string; definition: string },
  connection: DbConnectionConfig
) {
  const { runQuery } = await import("@/lib/sql")
  const sql = `CREATE OR REPLACE VIEW ${quoteIdent(input.schema)}.${quoteIdent(input.name)} AS
${input.definition.trim().replace(/;+\s*$/, "")};`
  await runQuery(sql, connection)
}

export async function dropView(
  schema: string,
  name: string,
  connection: DbConnectionConfig,
  cascade = true
) {
  const { runQuery } = await import("@/lib/sql")
  const sql = `DROP VIEW ${quoteIdent(schema)}.${quoteIdent(name)} ${
    cascade ? "CASCADE" : "RESTRICT"
  };`
  await runQuery(sql, connection)
}

export async function getViewDefinition(
  schema: string,
  name: string,
  connection: DbConnectionConfig
): Promise<string> {
  const { runQuery } = await import("@/lib/sql")
  const sql = `SELECT pg_get_viewdef(format('%I.%I', $1, $2)::regclass, true) AS definition`
  const result = await runQuery(sql, connection, [schema, name])
  const def = result.rows[0]?.definition
  return typeof def === "string" ? def : ""
}

export type GroupedForeignKey = {
  constraint_name: string
  columns: string[]
  referenced_schema: string
  referenced_table: string
  referenced_columns: string[]
}

export function groupOutgoingForeignKeys(
  table: PostgresTable
): GroupedForeignKey[] {
  const rels = (table.relationships || []).filter(
    (r) =>
      r.source_schema === table.schema && r.source_table_name === table.name
  )
  const map = new Map<string, GroupedForeignKey>()
  for (const r of rels) {
    const existing = map.get(r.constraint_name)
    if (existing) {
      if (!existing.columns.includes(r.source_column_name)) {
        existing.columns.push(r.source_column_name)
      }
      if (!existing.referenced_columns.includes(r.target_column_name)) {
        existing.referenced_columns.push(r.target_column_name)
      }
    } else {
      map.set(r.constraint_name, {
        constraint_name: r.constraint_name,
        columns: [r.source_column_name],
        referenced_schema: r.target_table_schema,
        referenced_table: r.target_table_name,
        referenced_columns: [r.target_column_name],
      })
    }
  }
  return [...map.values()]
}
