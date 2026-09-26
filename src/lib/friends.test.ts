import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { test } from "node:test"
import { consumeLoginLink, createLoginLink, saveAnonymousRoll, saveDailyRoll, setUsername } from "./accounts"
import { databaseFromSqlite, openDatabase } from "./db"
import {
  acceptFriend,
  cancelFriend,
  declineFriend,
  listFriendships,
  listFriendsBoard,
  removeFriend,
  requestFriend,
} from "./friends"
import { migrateRolls } from "./migrate-rolls"
import type { AppDatabase } from "./sql"

async function named(db: AppDatabase, email: string, username: string, now: number): Promise<string> {
  const created = await createLoginLink(db, email, now)
  assert.ok(!("error" in created))
  if ("error" in created) return ""
  const session = await consumeLoginLink(db, created.token, now)
  assert.ok(!("error" in session))
  if ("error" in session) return ""
  const namedAccount = await setUsername(db, session.accountId, username)
  assert.ok(!("error" in namedAccount))
  return session.accountId
}

test("friend requests need a username, a real player, and no duplicate", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T12:00:00.000Z")
  const ada = await named(db, "ada@example.com", "ada", now)
  const bea = await named(db, "bea@example.com", "bea", now)
  const unnamed = await createLoginLink(db, "cy@example.com", now)
  assert.ok(!("error" in unnamed))
  if ("error" in unnamed) return
  const cy = await consumeLoginLink(db, unnamed.token, now)
  assert.ok(!("error" in cy))
  if ("error" in cy) return

  const blocked = await requestFriend(db, cy.accountId, "ada", now)
  assert.equal("error" in blocked && blocked.error, "Pick a username first.")
  const missing = await requestFriend(db, ada, "nobody", now)
  assert.equal("error" in missing && missing.error, "No player has that username.")
  const self = await requestFriend(db, ada, "ADA", now)
  assert.equal("error" in self && self.error, "You cannot add yourself.")

  const sent = await requestFriend(db, ada, "bea", now)
  assert.ok(!("error" in sent))
  const again = await requestFriend(db, ada, "bea", now + 1)
  assert.equal("error" in again && again.error, "That request already exists.")
  const reverse = await requestFriend(db, bea, "ada", now + 2)
  assert.equal("error" in reverse && reverse.error, "That request already exists.")

  const waiting = await listFriendships(db, bea)
  assert.deepEqual(
    waiting.incoming.map((row) => row.username),
    ["ada"],
  )
  assert.equal(waiting.friends.length, 0)
})

test("accept, decline, cancel, and remove change who is on the friends board", async () => {
  const db = databaseFromSqlite(openDatabase(":memory:"))
  const now = Date.parse("2026-09-26T18:00:00.000Z")
  const ada = await named(db, "ada@example.com", "ada", now)
  const bea = await named(db, "bea@example.com", "bea", now)
  const cy = await named(db, "cy@example.com", "cyx", now)
  await saveDailyRoll(db, ada, now, () => ({ word: "quiz", score: "20" }))
  await saveDailyRoll(db, bea, now, () => ({ word: "aa", score: "100" }))
  await saveDailyRoll(db, cy, now, () => ({ word: "cat", score: "999" }))
  await saveAnonymousRoll(db, now, () => ({ word: "dog", score: "5000" }))

  const alone = await listFriendsBoard(db, ada, "today", now)
  assert.deepEqual(
    alone.map((row) => row.word),
    ["quiz"],
  )

  const sent = await requestFriend(db, ada, "bea", now)
  assert.ok(!("error" in sent))
  if ("error" in sent) return
  const declined = await declineFriend(db, bea, sent.id)
  assert.ok(!("error" in declined))
  const resent = await requestFriend(db, ada, "bea", now + 1)
  assert.ok(!("error" in resent))
  if ("error" in resent) return
  await cancelFriend(db, ada, resent.id)
  const third = await requestFriend(db, ada, "bea", now + 2)
  assert.ok(!("error" in third))
  if ("error" in third) return
  const accepted = await acceptFriend(db, bea, third.id)
  assert.ok(!("error" in accepted))
  const duplicate = await requestFriend(db, ada, "bea", now + 3)
  assert.equal("error" in duplicate && duplicate.error, "You are already friends.")

  const board = await listFriendsBoard(db, ada, "all", now + 3)
  assert.deepEqual(
    board.map((row) => [row.rank, row.username, row.word]),
    [
      [1, "bea", "aa"],
      [2, "ada", "quiz"],
    ],
  )

  const friends = await listFriendships(db, ada)
  assert.equal(friends.friends[0]?.username, "bea")
  await removeFriend(db, ada, friends.friends[0]!.id)
  const after = await listFriendsBoard(db, ada, "all", now + 4)
  assert.deepEqual(
    after.map((row) => row.word),
    ["quiz"],
  )
  assert.equal(cy.length > 0, true)
})

test("an older database grows a friendships table on first use", async () => {
  const raw = new DatabaseSync(":memory:")
  raw.exec(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    username_key TEXT UNIQUE,
    created_at INTEGER NOT NULL
  );
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
  const db = databaseFromSqlite(raw)
  await migrateRolls(db)
  const now = Date.parse("2026-09-26T12:00:00.000Z")
  const ada = await named(db, "ada@example.com", "ada", now)
  await named(db, "bea@example.com", "bea", now)
  const sent = await requestFriend(db, ada, "bea", now)
  assert.ok(!("error" in sent))
})
