import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { safeStorage } from 'electron'
import type { ClusterProfile, ClusterProfileInput, AppSettings, SaslConfig } from '@shared/types'
import { DEFAULT_SETTINGS, DEMO_PROFILE_NAME } from '@shared/types'

let db: Database.Database | null = null
let dataDir = ''
const DB_NAME = 'offset-explorer.db'

const SCHEMA_V1 = `
CREATE TABLE cluster_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bootstrap_servers TEXT NOT NULL,
  security_protocol TEXT NOT NULL CHECK (security_protocol IN ('PLAINTEXT','SSL','SASL_PLAINTEXT','SASL_SSL')),
  sasl_json TEXT,
  ssl_json TEXT,
  request_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  color TEXT NOT NULL DEFAULT 'none',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE credentials (
  profile_id TEXT PRIMARY KEY REFERENCES cluster_profiles(id) ON DELETE CASCADE,
  encrypted_password BLOB NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

export function initStore(userDataDir: string): void {
  dataDir = userDataDir
  db = new Database(join(userDataDir, DB_NAME))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    db.exec(SCHEMA_V1)
    db.pragma('user_version = 1')
  }
  seedDemoProfile()
}

export function closeStore(): void {
  db?.close()
  db = null
}

/**
 * Wipe every saved connection, credential and setting by deleting the database
 * file (and its WAL sidecars), then re-create a fresh store. Returns to the
 * built-in demo cluster and default settings.
 */
export function resetStore(): void {
  const dir = dataDir
  closeStore()
  for (const suffix of ['', '-wal', '-shm']) {
    const file = join(dir, DB_NAME + suffix)
    if (existsSync(file)) rmSync(file, { force: true })
  }
  initStore(dir)
}

function d(): Database.Database {
  if (!db) throw new Error('store not initialized')
  return db
}

interface ProfileRow {
  id: string
  name: string
  bootstrap_servers: string
  security_protocol: ClusterProfile['securityProtocol']
  sasl_json: string | null
  ssl_json: string | null
  request_timeout_ms: number
  color: ClusterProfile['color']
  is_demo: number
  created_at: string
}

function rowToProfile(row: ProfileRow): ClusterProfile {
  const sasl = row.sasl_json ? (JSON.parse(row.sasl_json) as Omit<SaslConfig, 'password'>) : undefined
  const hasPassword =
    d().prepare('SELECT 1 FROM credentials WHERE profile_id = ?').get(row.id) !== undefined
  return {
    id: row.id,
    name: row.name,
    bootstrapServers: row.bootstrap_servers,
    securityProtocol: row.security_protocol,
    sasl: sasl ? { ...sasl, hasPassword } : undefined,
    ssl: row.ssl_json ? JSON.parse(row.ssl_json) : undefined,
    requestTimeoutMs: row.request_timeout_ms,
    color: row.color,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at
  }
}

export function listProfiles(): ClusterProfile[] {
  const rows = d()
    .prepare('SELECT * FROM cluster_profiles ORDER BY is_demo DESC, name COLLATE NOCASE')
    .all() as ProfileRow[]
  return rows.map(rowToProfile)
}

export function getProfile(id: string): ClusterProfile {
  const row = d().prepare('SELECT * FROM cluster_profiles WHERE id = ?').get(id) as
    | ProfileRow
    | undefined
  if (!row) throw new Error(`cluster profile not found: ${id}`)
  return rowToProfile(row)
}

function saslForStorage(input: ClusterProfileInput): string | null {
  if (!input.sasl) return null
  const { password: _password, ...rest } = input.sasl
  return JSON.stringify(rest)
}

export function createProfile(input: ClusterProfileInput): ClusterProfile {
  const id = randomUUID()
  d()
    .prepare(
      `INSERT INTO cluster_profiles
       (id, name, bootstrap_servers, security_protocol, sasl_json, ssl_json, request_timeout_ms, color, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      id,
      input.name,
      input.bootstrapServers,
      input.securityProtocol,
      saslForStorage(input),
      input.ssl ? JSON.stringify(input.ssl) : null,
      input.requestTimeoutMs,
      input.color,
      new Date().toISOString()
    )
  if (input.sasl?.password) setPassword(id, input.sasl.password)
  return getProfile(id)
}

export function updateProfile(id: string, input: ClusterProfileInput): ClusterProfile {
  const existing = getProfile(id)
  if (existing.isDemo) throw new Error('the demo cluster profile cannot be edited')
  d()
    .prepare(
      `UPDATE cluster_profiles SET
       name = ?, bootstrap_servers = ?, security_protocol = ?, sasl_json = ?, ssl_json = ?,
       request_timeout_ms = ?, color = ? WHERE id = ?`
    )
    .run(
      input.name,
      input.bootstrapServers,
      input.securityProtocol,
      saslForStorage(input),
      input.ssl ? JSON.stringify(input.ssl) : null,
      input.requestTimeoutMs,
      input.color,
      id
    )
  if (input.sasl?.password) setPassword(id, input.sasl.password)
  if (!input.sasl) d().prepare('DELETE FROM credentials WHERE profile_id = ?').run(id)
  return getProfile(id)
}

export function deleteProfile(id: string): void {
  if (getProfile(id).isDemo) throw new Error('the demo cluster profile cannot be deleted')
  d().prepare('DELETE FROM cluster_profiles WHERE id = ?').run(id)
}

export function setPassword(profileId: string, password: string): void {
  const blob = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(password)
    : Buffer.from(password, 'utf8')
  d()
    .prepare(
      `INSERT INTO credentials (profile_id, encrypted_password) VALUES (?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET encrypted_password = excluded.encrypted_password`
    )
    .run(profileId, blob)
}

export function getPassword(profileId: string): string | null {
  const row = d()
    .prepare('SELECT encrypted_password FROM credentials WHERE profile_id = ?')
    .get(profileId) as { encrypted_password: Buffer } | undefined
  if (!row) return null
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(row.encrypted_password)
    : row.encrypted_password.toString('utf8')
}

function seedDemoProfile(): void {
  const exists = d().prepare('SELECT 1 FROM cluster_profiles WHERE is_demo = 1').get()
  if (exists) return
  d()
    .prepare(
      `INSERT INTO cluster_profiles
       (id, name, bootstrap_servers, security_protocol, sasl_json, ssl_json, request_timeout_ms, color, is_demo, created_at)
       VALUES (?, ?, 'demo:9092', 'PLAINTEXT', NULL, NULL, 30000, 'blue', 1, ?)`
    )
    .run(randomUUID(), DEMO_PROFILE_NAME, new Date().toISOString())
}

export function getAppSettings(): AppSettings {
  const rows = d().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function setAppSettings(patch: Partial<AppSettings>): AppSettings {
  const stmt = d().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) stmt.run(key, JSON.stringify(value))
  }
  return getAppSettings()
}
