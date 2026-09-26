import assert from "node:assert/strict"
import { test } from "node:test"
import {
  consumeLoginLink,
  createLoginLink,
  listBoard,
  normalizeUsername,
  periodStart,
  saveDailyRoll,
  setUsername,
} from "./accounts"
import { databaseFromSqlite, openDatabase } from "./db"
import { publicOrigin } from "./request-origin"

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
  const blocked = await saveDailyRoll(db, session.accountId, now, () => ({ word: "quiz", score: "10" }))
  assert.equal("error" in blocked && blocked.error, "Choose a username first.")
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
