export type PostgresSchema = {
  id: number
  name: string
  owner: string
}

export type PostgresColumn = {
  id: string
  table_id?: number
  name: string
  table: string
  schema: string
  data_type: string
  format: string
  is_identity: boolean
  is_generated: boolean
  is_nullable: boolean
  is_unique: boolean
  is_updatable: boolean
  default_value: string | null
  comment: string | null
  ordinal_position: number
}

export type PostgresTable = {
  id: number
  schema: string
  name: string
  rls_enabled: boolean
  rls_forced: boolean
  bytes: number
  size: string
  live_rows_estimate: number
  dead_rows_estimate: number
  comment: string | null
  columns?: PostgresColumn[]
  primary_keys: { name: string; schema: string; table_name: string }[]
  relationships?: PostgresRelationship[]
}

export type PostgresRelationship = {
  id?: number
  constraint_name: string
  source_schema: string
  source_table_name: string
  source_column_name: string
  target_table_schema: string
  target_table_name: string
  target_column_name: string
}

export type PostgresView = {
  id: number
  schema: string
  name: string
  is_updatable: boolean
  comment: string | null
  columns?: PostgresColumn[]
}

export type PostgresMaterializedView = {
  id: number
  schema: string
  name: string
  is_populated: boolean
  comment: string | null
  columns?: PostgresColumn[]
}

export type PostgresForeignTable = {
  id: number
  schema: string
  name: string
  comment: string | null
  columns?: PostgresColumn[]
}

export type PostgresFunction = {
  id: number
  schema: string
  name: string
  language: string
  return_type: string
  argument_types: string
  identity_argument_types?: string
  definition?: string
  complete_statement?: string
  behavior: string
  security_definer: boolean
}

export type PostgresRole = {
  id: number
  name: string
  is_superuser: boolean
  can_create_db: boolean
  can_create_role: boolean
  can_login: boolean
  is_replication_role: boolean
  can_bypass_rls: boolean
  active_connections: number
  connection_limit: number
}

export type PostgresExtension = {
  name: string
  schema: string | null
  default_version: string
  installed_version: string | null
  comment: string | null
}

export type PostgresIndex = {
  id: number
  schema: string
  table_id: number
  is_unique: boolean
  is_primary: boolean
  access_method: string
  index_definition: string
  comment: string | null
  index_attributes: { attribute_name: string; data_type: string }[]
}

export type PostgresTrigger = {
  id: number
  name: string
  schema: string
  table: string
  enabled_mode: string
  activation: string
  orientation: string
  events: string[]
  function_schema: string
  function_name: string
}

export type PostgresType = {
  id: number
  name: string
  schema: string
  format: string
  enums: string[]
  comment: string | null
}

export type PostgresPolicy = {
  id: number
  schema: string
  table: string
  table_id?: number
  name: string
  action: string
  roles: string[]
  command: string
  definition: string | null
  check: string | null
}

export type TablePrivilegeType =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "TRUNCATE"
  | "REFERENCES"
  | "TRIGGER"
  | "MAINTAIN"

export type PostgresTablePrivilegeGrant = {
  grantor: string
  grantee: string
  privilege_type: TablePrivilegeType
  is_grantable: boolean
}

export type PostgresTablePrivileges = {
  relation_id: number
  schema: string
  name: string
  kind:
    | "table"
    | "view"
    | "materialized_view"
    | "foreign_table"
    | "partitioned_table"
  privileges: PostgresTablePrivilegeGrant[]
}

export type PostgresPublication = {
  id: number
  name: string
  owner: string
  publish_insert: boolean
  publish_update: boolean
  publish_delete: boolean
  publish_truncate: boolean
}
