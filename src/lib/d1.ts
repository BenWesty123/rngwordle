import type { AppDatabase, SqlParam, SqlStatement } from "@/lib/sql"

type D1Statement = {
  bind(...values: unknown[]): D1Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results?: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}

/** The subset of the D1 binding this game uses. */
export type D1Binding = {
  prepare(query: string): D1Statement
  batch(statements: D1Statement[]): Promise<Array<{ meta?: { changes?: number } }>>
  exec(query: string): Promise<unknown>
}

function changesOf(meta: { changes?: number } | undefined): number {
  return Number(meta?.changes ?? 0)
}

export function databaseFromD1(db: D1Binding): AppDatabase {
  return {
    async get<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T | null> {
      const row = await db.prepare(sql).bind(...params).first<T>()
      return row ?? null
    },
    async all<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T[]> {
      const result = await db.prepare(sql).bind(...params).all<T>()
      return result.results ?? []
    },
    async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number }> {
      const result = await db.prepare(sql).bind(...params).run()
      return { changes: changesOf(result.meta) }
    },
    async batch(statements: SqlStatement[]): Promise<Array<{ changes: number }>> {
      const prepared = statements.map((statement) => db.prepare(statement.sql).bind(...statement.params))
      const results = await db.batch(prepared)
      return results.map((result) => ({ changes: changesOf(result.meta) }))
    },
    async exec(sql: string): Promise<void> {
      await db.exec(sql)
    },
  }
}
