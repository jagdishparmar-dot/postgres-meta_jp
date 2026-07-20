import type { DbConnectionConfig } from "@/lib/connection"
import {
  deleteMeta,
  fetchMeta,
  patchMeta,
  postMeta,
} from "@/lib/client-meta"
import type {
  PostgresPolicy,
  PostgresRole,
  PostgresTable,
  PostgresTablePrivileges,
  TablePrivilegeType,
} from "@/lib/types"

export const POLICY_COMMANDS = [
  "ALL",
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
] as const

export const POLICY_ACTIONS = ["PERMISSIVE", "RESTRICTIVE"] as const

export const TABLE_PRIVILEGE_TYPES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
  "MAINTAIN",
  "ALL",
] as const

export type PolicyCreateInput = {
  name: string
  schema: string
  table: string
  action?: (typeof POLICY_ACTIONS)[number]
  command?: (typeof POLICY_COMMANDS)[number]
  roles?: string[]
  definition?: string
  check?: string
}

export type PolicyUpdateInput = {
  name: string
  roles?: string[]
  definition?: string | null
  check?: string | null
}

export async function listTables(
  connection: DbConnectionConfig,
  includeSystem = false
): Promise<PostgresTable[]> {
  return fetchMeta<PostgresTable[]>(
    `tables?include_system_schemas=${includeSystem}&include_columns=false`,
    connection
  )
}

export async function listRoles(
  connection: DbConnectionConfig
): Promise<PostgresRole[]> {
  return fetchMeta<PostgresRole[]>("roles", connection)
}

export async function createPolicy(
  input: PolicyCreateInput,
  connection: DbConnectionConfig
): Promise<PostgresPolicy> {
  return postMeta<PostgresPolicy>(
    "policies",
    {
      name: input.name,
      schema: input.schema,
      table: input.table,
      action: input.action ?? "PERMISSIVE",
      command: input.command ?? "ALL",
      roles: input.roles?.length ? input.roles : ["public"],
      definition: input.definition || undefined,
      check: input.check || undefined,
    },
    connection
  )
}

export async function updatePolicy(
  id: number,
  input: PolicyUpdateInput,
  connection: DbConnectionConfig
): Promise<PostgresPolicy> {
  return patchMeta<PostgresPolicy>(
    `policies/${id}`,
    {
      name: input.name,
      roles: input.roles,
      definition: input.definition ?? undefined,
      check: input.check ?? undefined,
    },
    connection
  )
}

export async function dropPolicy(
  id: number,
  connection: DbConnectionConfig
): Promise<PostgresPolicy> {
  return deleteMeta<PostgresPolicy>(`policies/${id}`, connection)
}

export async function listTablePrivileges(
  connection: DbConnectionConfig,
  includeSystem = false
): Promise<PostgresTablePrivileges[]> {
  return fetchMeta<PostgresTablePrivileges[]>(
    `table-privileges?include_system_schemas=${includeSystem}`,
    connection
  )
}

export async function grantTablePrivileges(
  grants: {
    relation_id: number
    grantee: string
    privilege_type: TablePrivilegeType | "ALL"
    is_grantable?: boolean
  }[],
  connection: DbConnectionConfig
): Promise<PostgresTablePrivileges[]> {
  return postMeta<PostgresTablePrivileges[]>(
    "table-privileges",
    grants,
    connection
  )
}

export async function revokeTablePrivileges(
  revokes: {
    relation_id: number
    grantee: string
    privilege_type: TablePrivilegeType | "ALL"
  }[],
  connection: DbConnectionConfig
): Promise<PostgresTablePrivileges[]> {
  return deleteMeta<PostgresTablePrivileges[]>(
    "table-privileges",
    connection,
    revokes
  )
}

export function parseRolesInput(value: string): string[] {
  return value
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
}
