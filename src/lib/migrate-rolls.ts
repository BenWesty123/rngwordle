import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppDatabase } from "@/lib/sql"

/** Fresh tables. Anonymous rolls leave account_id null. A real account still has one row per UTC day. */
export const FRESH_SCHEMA = `CREATE TABLE IF NOT EXISTS accounts (
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
  account_id TEXT REFERENCES accounts(id),
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

const REBUILD_ROLLS = `DROP TABLE IF EXISTS rolls_next;
CREATE TABLE rolls_next (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  username TEXT NOT NULL,
  word TEXT NOT NULL,
  score TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  utc_day TEXT NOT NULL,
  UNIQUE (account_id, utc_day)
);
INSERT INTO rolls_next (id, account_id, username, word, score, played_at, utc_day)
SELECT id, account_id, username, word, score, played_at, utc_day FROM rolls;
DROP TABLE rolls;
ALTER TABLE rolls_next RENAME TO rolls;
CREATE INDEX IF NOT EXISTS rolls_played_at ON rolls (played_at);
CREATE INDEX IF NOT EXISTS rolls_utc_day ON rolls (utc_day);
`

/** Create missing tables, then rebuild an older rolls table that required an account. */
export async function migrateRolls(db: AppDatabase): Promise<void> {
  await db.exec(FRESH_SCHEMA)
  const columns = await db.all<{ name: string; notnull: number | string }>("PRAGMA table_info(rolls)")
  const accountId = columns.find((column) => column.name === "account_id")
  if (!accountId || Number(accountId.notnull) === 0) return
  await db.exec(REBUILD_ROLLS)
}

export function freshSchemaFile(): string {
  return readFileSync(join(process.cwd(), "migrations", "0001_accounts.sql"), "utf8")
}
