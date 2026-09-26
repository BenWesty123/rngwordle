import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

/**
 * Local SQLite for this dev server. No hosted database and no API keys.
 *
 * The tables are written so a later move to Postgres is a type mapping, not a redesign:
 * text primary keys, integer unix milliseconds (bigint there), unique constraints,
 * and a lowercase username_key instead of a SQLite-only collation. Score is a digit
 * string so it can become NUMERIC without losing rank order.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  username_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_links (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rolls (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  username TEXT NOT NULL,
  word TEXT NOT NULL,
  score TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  utc_day TEXT NOT NULL,
  UNIQUE (account_id, utc_day)
);

CREATE INDEX IF NOT EXISTS rolls_played_at ON rolls (played_at);
CREATE INDEX IF NOT EXISTS rolls_utc_day ON rolls (utc_day);
`

const globalForDb = globalThis as unknown as { rngworldeDb?: DatabaseSync }

export function openDatabase(filename: string): DatabaseSync {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec("PRAGMA foreign_keys = ON;")
  db.exec(SCHEMA)
  const version = db.prepare("SELECT version FROM schema_migrations WHERE version = 1").get()
  if (!version) db.prepare("INSERT INTO schema_migrations (version) VALUES (1)").run()
  return db
}

export function databasePath(): string {
  return join(process.cwd(), "data", "local.sqlite")
}

export function getDb(): DatabaseSync {
  if (!globalForDb.rngworldeDb) globalForDb.rngworldeDb = openDatabase(databasePath())
  return globalForDb.rngworldeDb
}
