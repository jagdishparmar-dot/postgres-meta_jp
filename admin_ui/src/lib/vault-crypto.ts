import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const DATA_DIR = join(process.cwd(), ".data")
const KEY_FILE = join(DATA_DIR, "vault.key")
const SALT = "pgadmin-connection-vault-v1"

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/** 32-byte key from env or auto-generated file under `.data/`. */
export function getVaultKey(): Buffer {
  const fromEnv = process.env.CONNECTION_VAULT_KEY?.trim()
  if (fromEnv && fromEnv.length >= 16) {
    return scryptSync(fromEnv, SALT, 32)
  }

  ensureDataDir()
  if (existsSync(KEY_FILE)) {
    const hex = readFileSync(KEY_FILE, "utf8").trim()
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      return Buffer.from(hex, "hex")
    }
  }

  const key = randomBytes(32)
  writeFileSync(KEY_FILE, key.toString("hex"), { mode: 0o600 })
  return key
}

/** AES-256-GCM: base64(iv || tag || ciphertext) */
export function encryptSecret(plaintext: string): string {
  const key = getVaultKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptSecret(payload: string): string {
  const key = getVaultKey()
  const buf = Buffer.from(payload, "base64")
  if (buf.length < 28) {
    throw new Error("Invalid encrypted payload")
  }
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  )
}

export function getDataDir() {
  ensureDataDir()
  return DATA_DIR
}
