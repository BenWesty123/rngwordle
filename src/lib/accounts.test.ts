import assert from "node:assert/strict"
import { test } from "node:test"
import { DatabaseSync } from "node:sqlite"
import {
  ANONYMOUS_NAME,
  consumeLoginLink,
  createLoginLink,
  listBoard,
  normalizeUsername,
  periodStart,
  saveAnonymousRoll,
  saveDailyRoll,
  setUsername,
} from "./accounts"
import { databaseFromSqlite, openDatabase } from "./db"
import { databaseFromD1, type D1Binding } from "./d1"
import { freshSchemaFile, FRESH_SCHEMA, migrateRolls } from "./migrate-rolls"
import { publicOrigin } from "./request-origin"
import { sqlStatements } from "./sql-statements"

function sqlBody(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim()
}

test("login links use the browser host, not the bind address", () => {
  const loopback = new Request("http://0.0.0.0:4721/api/auth/request", { headers: { host: "127.0.0.1:4721" } })
  assert.equal(publicOrigin(loopback), "http://127.0.0.1:4721")
  const forwarded = new Request("http://0.0.0.0:4721/api/auth/request", {
    headers: { "x-forwarded-host": "play.example, internal", "x-forwarded-proto": "https" },
  })
  assert.equal(publicOrigin(forwarded), "https://play.example")
  const bound = new Request("http://0.0.0.0:4721/api/auth/request", { headers: { host: "0.0.0.0:4721" } })
  assert.equal(publicOrigin(bound), "http://0.0.0.0:4721")
})

test("usernames are 3 to 20 letters, numbers, or underscores", () => {
  assert.equal(normalizeUsername("ab"), null)
  assert.equal(normalizeUsername("tile witch"), null)
  assert.equal(normalizeUsername("tile-witch"), null)
  assert.equal(normalizeUsername("a".repeat(21)), null)
  assert.equal(normalizeUsername("  tile_witch  "), "tile_witch")
  assert.equal(normalizeUsername("A1_"), "A1_")
})

test("week starts Monday 00:00 UTC and month starts on the 1st", () => {
  const saturday = new Date("2026-09-26T15:00:00.000Z")
  assert.equal(periodStart("today", saturday), Date.parse("2026-09-26T00:00:00.000Z"))
  assert.equal(periodStart("week", saturday), Date.parse("2026-09-21T00:00:00.000Z"))
  assert.equal(periodStart("month", saturday), Date.parse("2026-09-01T00:00:00.000Z"))
  assert.equal(periodStart("all", saturday), null)
  const sunday = new Date("2026-09-27T23:00:00.000Z")
  assert.equal(periodStart("week", sunday), Date.parse("2026-09-21T00:00:00.000Z"))
  const previousSunday = new Date("2026-09-20T12:00:00.000Z")
  assert.equal(periodStart("week", previousSunday), Date.parse("2026-09-14T00:00:00.000Z"))
})

test("a login link works once, then a username can be claimed", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T12:00:00.000Z")
  const created = await createLoginLink(db, "  Ada@Example.com ", now)
  assert.ok(!("error" in created))
  if ("error" in created) return
  const first = await consumeLoginLink(db, created.token, now)
  assert.ok(!("error" in first))
  if ("error" in first) return
  assert.equal(first.username, null)
  const reused = await consumeLoginLink(db, created.token, now)
  assert.equal("error" in reused && reused.error, "used")
  const reusedLater = await consumeLoginLink(db, created.token, now + 31 * 60 * 1000)
  assert.equal("error" in reusedLater && reusedLater.error, "used")

  const expired = await createLoginLink(db, "ada@example.com", now)
  assert.ok(!("error" in expired))
  if ("error" in expired) return
  const expiredResult = await consumeLoginLink(db, expired.token, now + 31 * 60 * 1000)
  assert.equal("error" in expiredResult && expiredResult.error, "expired")

  const invalidName = await setUsername(db, first.accountId, "ab")
  assert.equal("error" in invalidName && invalidName.error, "Use 3 to 20 letters, numbers, or underscores.")
  const named = await setUsername(db, first.accountId, "Ada_1")
  assert.deepEqual(named, { username: "Ada_1" })

  const other = await createLoginLink(db, "bea@example.com", now)
  assert.ok(!("error" in other))
  if ("error" in other) return
  const second = await consumeLoginLink(db, other.token, now)
  assert.ok(!("error" in second))
  if ("error" in second) return
  const taken = await setUsername(db, second.accountId, "ada_1")
  assert.equal("error" in taken && taken.error, "That name is taken.")
})

test("a logged-in account keeps one roll per UTC day and the board ranks by score", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T18:00:00.000Z")
  const created = await createLoginLink(db, "ada@example.com", now)
  assert.ok(!("error" in created))
  if ("error" in created) return
  const session = await consumeLoginLink(db, created.token, now)
  assert.ok(!("error" in session))
  if ("error" in session) return
  await setUsername(db, session.accountId, "ada")

  const first = await saveDailyRoll(db, session.accountId, now, () => ({ word: "quiz", score: "25344" }))
  assert.ok(!("error" in first))
  if ("error" in first) return
  assert.equal(first.created, true)
  assert.equal(first.roll.word, "quiz")
  assert.equal(first.roll.username, "ada")

  const again = await saveDailyRoll(db, session.accountId, now + 60_000, () => ({ word: "banana", score: "999999" }))
  assert.ok(!("error" in again))
  if ("error" in again) return
  assert.equal(again.created, false)
  assert.equal(again.roll.word, "quiz")
  assert.equal(again.roll.score, "25344")

  const monday = Date.parse("2026-09-21T00:00:00.000Z")
  const sundayBefore = Date.parse("2026-09-20T23:00:00.000Z")
  const other = await createLoginLink(db, "bea@example.com", now)
  assert.ok(!("error" in other))
  if ("error" in other) return
  const bea = await consumeLoginLink(db, other.token, now)
  assert.ok(!("error" in bea))
  if ("error" in bea) return
  await setUsername(db, bea.accountId, "bea")
  await saveDailyRoll(db, bea.accountId, monday, () => ({ word: "aa", score: "1000" }))
  await saveDailyRoll(db, bea.accountId, sundayBefore, () => ({ word: "cat", score: "5000" }))
  await saveDailyRoll(db, session.accountId, Date.parse("2026-09-22T12:00:00.000Z"), () => ({ word: "tone", score: "1000" }))

  const today = await listBoard(db, "today", now)
  assert.deepEqual(
    today.map((row) => row.word),
    ["quiz"],
  )
  const week = await listBoard(db, "week", now)
  assert.deepEqual(
    week.map((row) => [row.rank, row.username, row.word, row.score]),
    [
      [1, "ada", "quiz", "25344"],
      [2, "bea", "aa", "1000"],
      [3, "ada", "tone", "1000"],
    ],
  )
  const all = await listBoard(db, "all", now)
  assert.deepEqual(
    all.map((row) => row.word),
    ["quiz", "cat", "aa", "tone"],
  )
})

test("a logged-in account without a username still saves one Anonymous roll per UTC day", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T18:00:00.000Z")
  const created = await createLoginLink(db, "ada@example.com", now)
  assert.ok(!("error" in created))
  if ("error" in created) return
  const session = await consumeLoginLink(db, created.token, now)
  assert.ok(!("error" in session))
  if ("error" in session) return

  const first = await saveDailyRoll(db, session.accountId, now, () => ({ word: "quiz", score: "10" }))
  assert.ok(!("error" in first))
  if ("error" in first) return
  assert.equal(first.created, true)
  assert.equal(first.roll.username, ANONYMOUS_NAME)

  const again = await saveDailyRoll(db, session.accountId, now + 60_000, () => ({ word: "banana", score: "999999" }))
  assert.ok(!("error" in again))
  if ("error" in again) return
  assert.equal(again.created, false)
  assert.equal(again.roll.word, "quiz")
  assert.equal(again.roll.score, "10")

  const board = await listBoard(db, "today", now + 60_000)
  assert.deepEqual(
    board.map((row) => [row.username, row.word]),
    [[ANONYMOUS_NAME, "quiz"]],
  )
})

test("logged-out generates each add an Anonymous row and do not create an account", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T18:00:00.000Z")
  const first = await saveAnonymousRoll(db, now, () => ({ word: "quiz", score: "42" }))
  const second = await saveAnonymousRoll(db, now + 1_000, () => ({ word: "banana", score: "7" }))
  assert.ok(!("error" in first) && !("error" in second))
  if ("error" in first || "error" in second) return
  assert.equal(first.created, true)
  assert.equal(second.created, true)

  const accounts = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM accounts")
  assert.equal(accounts?.n, 0)
  const board = await listBoard(db, "today", now + 1_000)
  assert.deepEqual(
    board.map((row) => [row.username, row.word, row.score]),
    [
      [ANONYMOUS_NAME, "quiz", "42"],
      [ANONYMOUS_NAME, "banana", "7"],
    ],
  )
})

test("an older rolls table that required an account can store anonymous rolls", async () => {
  assert.equal(sqlBody(freshSchemaFile()), sqlBody(FRESH_SCHEMA))
  const raw = new DatabaseSync(":memory:")
  raw.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    username_key TEXT UNIQUE,
    created_at INTEGER NOT NULL
  );
  INSERT INTO accounts (id, email, username, username_key, created_at)
  VALUES ('acct', 'ada@example.com', 'ada', 'ada', 1);
  CREATE TABLE rolls (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    word TEXT NOT NULL,
    score TEXT NOT NULL,
    played_at INTEGER NOT NULL,
    utc_day TEXT NOT NULL,
    UNIQUE (account_id, utc_day)
  );`)
  raw.exec(
    "INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day) VALUES ('old', 'acct', 'ada', 'quiz', '10', 1, '2026-09-26')",
  )
  const db = databaseFromSqlite(raw)
  await migrateRolls(db)
  const kept = await db.get<{ username: string; word: string }>("SELECT username, word FROM rolls WHERE id = 'old'")
  assert.equal(kept?.username, "ada")
  assert.equal(kept?.word, "quiz")

  const first = await saveAnonymousRoll(db, Date.parse("2026-09-26T12:00:00.000Z"), () => ({ word: "cat", score: "3" }))
  const second = await saveAnonymousRoll(db, Date.parse("2026-09-26T12:01:00.000Z"), () => ({ word: "dog", score: "4" }))
  assert.ok(!("error" in first) && !("error" in second))
  const rows = await db.all<{ account_id: string | null }>(
    "SELECT account_id FROM rolls WHERE username = ? ORDER BY played_at ASC",
    ANONYMOUS_NAME,
  )
  assert.deepEqual(
    rows.map((row) => row.account_id),
    [null, null],
  )
})

test("a formatted CREATE TABLE is not a finished statement on its first line", () => {
  const firstLine = FRESH_SCHEMA.split("\n").map((line) => line.trim()).find(Boolean)
  assert.equal(firstLine, "CREATE TABLE IF NOT EXISTS accounts (")
  const raw = new DatabaseSync(":memory:")
  assert.throws(() => raw.exec(firstLine ?? ""))
  for (const statement of sqlStatements(FRESH_SCHEMA)) raw.exec(statement)
  const columns = raw.prepare("PRAGMA table_info(rolls)").all() as Array<{ name: string; notnull: number }>
  assert.equal(columns.find((column) => column.name === "account_id")?.notnull, 0)
})

test("D1 migration prepares each statement because exec splits on newlines", async () => {
  const raw = new DatabaseSync(":memory:")
  raw.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    username_key TEXT UNIQUE,
    created_at INTEGER NOT NULL
  );
  INSERT INTO accounts (id, email, username, username_key, created_at)
  VALUES ('acct', 'ada@example.com', 'ada', 'ada', 1);
  CREATE TABLE rolls (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    word TEXT NOT NULL,
    score TEXT NOT NULL,
    played_at INTEGER NOT NULL,
    utc_day TEXT NOT NULL,
    UNIQUE (account_id, utc_day)
  );
  INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day)
  VALUES ('old', 'acct', 'ada', 'quiz', '10', 1, '2026-09-26');`)
  const db = databaseFromD1(d1ThatRejectsScriptExec(raw))
  await migrateRolls(db)
  const kept = await db.get<{ word: string }>("SELECT word FROM rolls WHERE id = 'old'")
  assert.equal(kept?.word, "quiz")
  const saved = await saveAnonymousRoll(db, Date.parse("2026-09-26T12:00:00.000Z"), () => ({ word: "cat", score: "3" }))
  assert.ok(!("error" in saved))
  const columns = await db.all<{ name: string; notnull: number }>("PRAGMA table_info(rolls)")
  assert.equal(Number(columns.find((column) => column.name === "account_id")?.notnull), 0)
})

test("a rebuild that already dropped rolls keeps the copied rows", async () => {
  const raw = new DatabaseSync(":memory:")
  raw.exec(`CREATE TABLE rolls_next (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    username TEXT NOT NULL,
    word TEXT NOT NULL,
    score TEXT NOT NULL,
    played_at INTEGER NOT NULL,
    utc_day TEXT NOT NULL,
    UNIQUE (account_id, utc_day)
  );
  INSERT INTO rolls_next (id, account_id, username, word, score, played_at, utc_day)
  VALUES ('kept', NULL, 'Anonymous', 'quiz', '10', 1, '2026-09-26');`)
  const db = databaseFromSqlite(raw)
  await migrateRolls(db)
  const kept = await db.get<{ word: string; account_id: string | null }>(
    "SELECT word, account_id FROM rolls WHERE id = 'kept'",
  )
  assert.equal(kept?.word, "quiz")
  assert.equal(kept?.account_id, null)
  const leftover = await db.get<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'rolls_next'")
  assert.equal(leftover, null)
})

function d1ThatRejectsScriptExec(raw: DatabaseSync): D1Binding {
  return {
    prepare(query: string) {
      let params: unknown[] = []
      const statement = {
        bind(...values: unknown[]) {
          params = values
          return statement
        },
        async first<T>() {
          const row = raw.prepare(query).get(...params) as T | undefined
          return row ?? null
        },
        async all<T>() {
          return { results: raw.prepare(query).all(...params) as T[] }
        },
        async run() {
          const result = raw.prepare(query).run(...params)
          return { meta: { changes: Number(result.changes) } }
        },
      }
      return statement
    },
    async batch() {
      throw new Error("batch is unused")
    },
    async exec(query: string) {
      throw new Error(`D1 exec splits on newlines: ${query.split("\n")[0]}`)
    },
  }
}
