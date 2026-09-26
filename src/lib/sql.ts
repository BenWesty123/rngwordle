export type SqlParam = string | number | null

export type SqlStatement = {
  sql: string
  params: SqlParam[]
}

/** Shared by the local SQLite file and the Cloudflare D1 binding. */
export type AppDatabase = {
  get<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T | null>
  all<T extends Record<string, SqlParam>>(sql: string, ...params: SqlParam[]): Promise<T[]>
  run(sql: string, ...params: SqlParam[]): Promise<{ changes: number }>
  /** Later statements see earlier writes. The whole list commits or rolls back together. */
  batch(statements: SqlStatement[]): Promise<Array<{ changes: number }>>
  exec(sql: string): Promise<void>
}
