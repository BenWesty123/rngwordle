import { readFileSync } from "node:fs"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { AppDatabase, SqlParam, SqlStatement } from "@/lib/sql"

/**
 * Local SQLite for `next dev`, used when the Cloudflare D1 binding is absent.
 * Production uses the `DB` binding and migrations/0001_accounts.sql.
 */

const SCHEMA = readFileSync(join(process.cwd(), "migrations", "0001_accounts.sql"), "utf8")

const globalForDb = globalThis as unknown as { rngworldeDb?: DatabaseSync }

export function openDatabase(filename: string): DatabaseSync {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec("PRAGMA foreign_keys = ON;")
  db.exec(SCHEMA)
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);")
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

export function databaseFromSqlite(db: DatabaseSync): AppDatabase {
  return {
    async get<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T | null> {
      const row = db.prepare(sql).get(...params) as T | undefined
      return row ?? null
    },
    async all<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[]
    },
    async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number }> {
      const result = db.prepare(sql).run(...params)
      return { changes: Number(result.changes) }
    },
    async batch(statements: SqlStatement[]): Promise<Array<{ changes: number }>> {
      db.exec("BEGIN IMMEDIATE")
      try {
        const results = statements.map((statement) => {
          const result = db.prepare(statement.sql).run(...statement.params)
          return { changes: Number(result.changes) }
        })
        db.exec("COMMIT")
        return results
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },
  }
}
