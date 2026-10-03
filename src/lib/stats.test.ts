import assert from "node:assert/strict"
import { test } from "node:test"
import { createLoginLink, saveDailyRoll, saveGuestRoll, setUsername } from "./accounts"
import { canSeeStats } from "./config"
import { bumpCounter, isClientCounter } from "./counters"
import { databaseFromSqlite, openDatabase } from "./db"
import { migrateRolls } from "./migrate-rolls"
import { loadStats } from "./stats"

test("stats add up rolls, people, sign-ups, and anonymous counters by UTC day", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  await migrateRolls(db)
  const now = Date.parse("2026-10-03T15:00:00.000Z")
  const yesterday = now - 24 * 60 * 60 * 1000
  const draw = () => ({ word: "salt", score: "100" })

  const link = await createLoginLink(db, "ada@example.com", now)
  assert.ok(!("error" in link))
  const account = await db.get<{ id: string }>("SELECT id FROM accounts WHERE email = ?", "ada@example.com")
  await setUsername(db, account!.id, "Ada")
  await saveDailyRoll(db, account!.id, now, draw)
  await saveGuestRoll(db, "guest-one-aaaaaaaaaaaaaaaaaaaa", now, draw)
  await saveGuestRoll(db, "guest-two-bbbbbbbbbbbbbbbbbbbb", now, draw)
  await saveGuestRoll(db, "guest-one-aaaaaaaaaaaaaaaaaaaa", yesterday, draw)
  await bumpCounter(db, "share:whatsapp", now)
  await bumpCounter(db, "share:whatsapp", now)
  await bumpCounter(db, "share:discord", now)
  await bumpCounter(db, "shared_link_view", now)
  await bumpCounter(db, "shared_link_roll", now)
  await bumpCounter(db, "practice_roll", yesterday)

  const { days, totals } = await loadStats(db, now)
  assert.equal(days.length, 14)
  assert.equal(days[0]!.day, "2026-10-03")
  assert.deepEqual(
    { rolls: days[0]!.rolls, players: days[0]!.players, guests: days[0]!.guests, signups: days[0]!.signups, named: days[0]!.named },
    { rolls: 3, players: 1, guests: 2, signups: 1, named: 1 },
  )
  assert.equal(days[0]!.shares, 3)
  assert.equal(days[0]!.channels.whatsapp, 2)
  assert.equal(days[0]!.sharedViews, 1)
  assert.equal(days[0]!.sharedRolls, 1)
  assert.equal(days[1]!.rolls, 1)
  assert.equal(days[1]!.practice, 1)
  assert.deepEqual(totals, { accounts: 1, named: 1, rolls: 4, friendships: 0 })
})

test("the browser can only report known counters", () => {
  assert.equal(isClientCounter("share:whatsapp"), true)
  assert.equal(isClientCounter("shared_link_view"), true)
  assert.equal(isClientCounter("practice_roll"), false)
  assert.equal(isClientCounter("share:anything"), false)
})

test("only listed usernames can see stats", async () => {
  process.env.STATS_USERNAMES = "Westy, Bester"
  assert.equal(await canSeeStats("Westy"), true)
  assert.equal(await canSeeStats("westy"), true)
  assert.equal(await canSeeStats("Bester"), true)
  assert.equal(await canSeeStats("Bizkit912"), false)
  assert.equal(await canSeeStats(null), false)
  delete process.env.STATS_USERNAMES
  assert.equal(await canSeeStats("Westy"), false)
})
