import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"
import {
  buildConnectionString,
  type DbConnectionConfig,
  type SavedConnection,
  type SslMode,
} from "@/lib/connection"
import { decryptSecret, encryptSecret, getDataDir } from "@/lib/vault-crypto"

type VaultRecord = {
  id: string
  name: string
  host: string
  port: string
  database: string
  user: string
  sslMode: SslMode
  passwordCipher: string
  createdAt: string
  updatedAt: string
}

type VaultFile = {
  version: 1
  connections: VaultRecord[]
}

const VAULT_FILE = () => join(getDataDir(), "connections.vault.json")

function readVault(): VaultFile {
  const path = VAULT_FILE()
  if (!existsSync(path)) {
    return { version: 1, connections: [] }
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as VaultFile
    if (!raw?.connections || !Array.isArray(raw.connections)) {
      return { version: 1, connections: [] }
    }
    return { version: 1, connections: raw.connections }
  } catch {
    return { version: 1, connections: [] }
  }
}

function writeVault(vault: VaultFile) {
  writeFileSync(VAULT_FILE(), JSON.stringify(vault, null, 2), { mode: 0o600 })
}

function toPublic(record: VaultRecord): SavedConnection {
  return {
    id: record.id,
    name: record.name,
    host: record.host,
    port: record.port,
    database: record.database,
    user: record.user,
    sslMode: record.sslMode,
    updatedAt: record.updatedAt,
  }
}

export function listSavedConnections(): SavedConnection[] {
  return readVault()
    .connections.map(toPublic)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
}

export function getSavedConnection(id: string): SavedConnection | null {
  const record = readVault().connections.find((c) => c.id === id)
  return record ? toPublic(record) : null
}

export function getConnectionConfig(id: string): DbConnectionConfig | null {
  const record = readVault().connections.find((c) => c.id === id)
  if (!record) return null
  try {
    return {
      id: record.id,
      name: record.name,
      host: record.host,
      port: record.port,
      database: record.database,
      user: record.user,
      sslMode: record.sslMode,
      password: decryptSecret(record.passwordCipher),
    }
  } catch {
    return null
  }
}

export function getConnectionString(id: string): string | null {
  const config = getConnectionConfig(id)
  if (!config?.password) return null
  return buildConnectionString(config)
}

export function upsertConnection(input: {
  id?: string
  name: string
  host: string
  port: string
  database: string
  user: string
  sslMode: SslMode
  password?: string
}): SavedConnection {
  const vault = readVault()
  const now = new Date().toISOString()
  const existingIndex = input.id
    ? vault.connections.findIndex((c) => c.id === input.id)
    : -1

  if (existingIndex >= 0) {
    const prev = vault.connections[existingIndex]
    const passwordCipher =
      input.password && input.password.length > 0
        ? encryptSecret(input.password)
        : prev.passwordCipher

    const next: VaultRecord = {
      ...prev,
      name: input.name.trim() || prev.name,
      host: input.host,
      port: input.port,
      database: input.database,
      user: input.user,
      sslMode: input.sslMode,
      passwordCipher,
      updatedAt: now,
    }
    vault.connections[existingIndex] = next
    writeVault(vault)
    return toPublic(next)
  }

  if (input.password === undefined) {
    throw new Error("Password is required for a new connection")
  }

  const record: VaultRecord = {
    id: input.id || randomUUID(),
    name: input.name.trim() || "Postgres",
    host: input.host,
    port: input.port || "5432",
    database: input.database,
    user: input.user,
    sslMode: input.sslMode,
    passwordCipher: encryptSecret(input.password),
    createdAt: now,
    updatedAt: now,
  }
  vault.connections.push(record)
  writeVault(vault)
  return toPublic(record)
}

export function deleteConnection(id: string): boolean {
  const vault = readVault()
  const next = vault.connections.filter((c) => c.id !== id)
  if (next.length === vault.connections.length) return false
  writeVault({ version: 1, connections: next })
  return true
}
