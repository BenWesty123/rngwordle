import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppDatabase } from "@/lib/sql"
import { sqlStatements } from "@/lib/sql-statements"

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

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES accounts(id),
  addressee_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  pair_lo TEXT NOT NULL,
  pair_hi TEXT NOT NULL,
  UNIQUE (pair_lo, pair_hi)
);

CREATE INDEX IF NOT EXISTS friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee_id);

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
  const fresh = sqlStatements(FRESH_SCHEMA)
  const rollsAt = fresh.findIndex((statement) => /^CREATE TABLE IF NOT EXISTS rolls\b/i.test(statement))
  if (rollsAt < 0) throw new Error("The rolls table is missing from the schema")
  await db.exec(fresh.slice(0, rollsAt).join(";\n"))

  // A rebuild that stopped after DROP TABLE rolls left the copy in rolls_next.
  // Create the empty rolls table only after that copy is renamed back.
  if ((await tableExists(db, "rolls_next")) && !(await tableExists(db, "rolls"))) {
    await db.exec(`ALTER TABLE rolls_next RENAME TO rolls;
CREATE INDEX IF NOT EXISTS rolls_played_at ON rolls (played_at);
CREATE INDEX IF NOT EXISTS rolls_utc_day ON rolls (utc_day);`)
    return
  }

  await db.exec(fresh.slice(rollsAt).join(";\n"))
  if (!(await rollsRequireAccount(db))) return
  await db.exec(REBUILD_ROLLS)
}

async function tableExists(db: AppDatabase, name: string): Promise<boolean> {
  const row = await db.get<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name)
  return row != null
}

async function rollsRequireAccount(db: AppDatabase): Promise<boolean> {
  const columns = await db.all<{ name: string; notnull: number | string }>("PRAGMA table_info(rolls)")
  const accountId = columns.find((column) => column.name === "account_id")
  return accountId != null && Number(accountId.notnull) === 1
}

export function freshSchemaFile(): string {
  return readFileSync(join(process.cwd(), "migrations", "0001_accounts.sql"), "utf8")
}
