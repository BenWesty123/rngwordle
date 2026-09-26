import { randomUUID } from "node:crypto"
import { normalizeUsername, periodStart, type BoardRow, type BoardView } from "@/lib/accounts"
import type { AppDatabase } from "@/lib/sql"

export type FriendEntry = {
  id: string
  username: string
}

export type FriendList = {
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
  friends: FriendEntry[]
}

type FriendshipRow = {
  id: string
  status: string
  requester_id: string
  addressee_id: string
  requester_name: string | null
  addressee_name: string | null
}

function pairEnds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export async function listFriendships(db: AppDatabase, accountId: string): Promise<FriendList> {
  const rows = await db.all<FriendshipRow>(
    `SELECT friendships.id, friendships.status, friendships.requester_id, friendships.addressee_id,
            requester.username AS requester_name, addressee.username AS addressee_name
     FROM friendships
     JOIN accounts AS requester ON requester.id = friendships.requester_id
     JOIN accounts AS addressee ON addressee.id = friendships.addressee_id
     WHERE friendships.requester_id = ? OR friendships.addressee_id = ?`,
    accountId,
    accountId,
  )
  const list: FriendList = { incoming: [], outgoing: [], friends: [] }
  for (const row of rows) {
    const incoming = row.addressee_id === accountId
    const username = incoming ? row.requester_name : row.addressee_name
    if (!username) continue
    const entry = { id: row.id, username }
    if (row.status === "accepted") list.friends.push(entry)
    else if (incoming) list.incoming.push(entry)
    else list.outgoing.push(entry)
  }
  const byName = (a: FriendEntry, b: FriendEntry) => a.username.localeCompare(b.username)
  list.incoming.sort(byName)
  list.outgoing.sort(byName)
  list.friends.sort(byName)
  return list
}

export async function requestFriend(
  db: AppDatabase,
  accountId: string,
  rawUsername: string,
  now = Date.now(),
): Promise<{ id: string; username: string } | { error: string }> {
  const self = await db.get<{ username: string | null }>("SELECT username FROM accounts WHERE id = ?", accountId)
  if (!self) return { error: "That account is gone." }
  if (!self.username) return { error: "Pick a username first." }
  const username = normalizeUsername(rawUsername)
  if (!username) return { error: "No player has that username." }
  const other = await db.get<{ id: string; username: string }>(
    "SELECT id, username FROM accounts WHERE username_key = ? AND username IS NOT NULL",
    username.toLowerCase(),
  )
  if (!other) return { error: "No player has that username." }
  if (other.id === accountId) return { error: "You cannot add yourself." }
  const [pairLo, pairHi] = pairEnds(accountId, other.id)
  const existing = await db.get<{ status: string }>(
    "SELECT status FROM friendships WHERE pair_lo = ? AND pair_hi = ?",
    pairLo,
    pairHi,
  )
  if (existing?.status === "accepted") return { error: "You are already friends." }
  if (existing) return { error: "That request already exists." }
  const id = randomUUID()
  try {
    await db.run(
      `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, pair_lo, pair_hi)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      id,
      accountId,
      other.id,
      now,
      pairLo,
      pairHi,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("UNIQUE") || message.includes("constraint")) return { error: "That request already exists." }
    throw error
  }
  return { id, username: other.username }
}

async function friendshipFor(
  db: AppDatabase,
  id: string,
): Promise<{ id: string; requester_id: string; addressee_id: string; status: string } | null> {
  return db.get<{ id: string; requester_id: string; addressee_id: string; status: string }>(
    "SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?",
    id,
  )
}

export async function acceptFriend(db: AppDatabase, accountId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const row = await friendshipFor(db, id)
  if (!row || row.addressee_id !== accountId) return { error: "That request is not yours." }
  if (row.status !== "pending") return { error: "That request is no longer pending." }
  const changed = await db.run(
    "UPDATE friendships SET status = 'accepted' WHERE id = ? AND addressee_id = ? AND status = 'pending'",
    id,
    accountId,
  )
  if (changed.changes !== 1) return { error: "That request is no longer pending." }
  return { ok: true }
}

export async function declineFriend(db: AppDatabase, accountId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const row = await friendshipFor(db, id)
  if (!row || row.addressee_id !== accountId) return { error: "That request is not yours." }
  if (row.status !== "pending") return { error: "That request is no longer pending." }
  await db.run("DELETE FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'", id, accountId)
  return { ok: true }
}

export async function cancelFriend(db: AppDatabase, accountId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const row = await friendshipFor(db, id)
  if (!row || row.requester_id !== accountId) return { error: "That request is not yours." }
  if (row.status !== "pending") return { error: "That request is no longer pending." }
  await db.run("DELETE FROM friendships WHERE id = ? AND requester_id = ? AND status = 'pending'", id, accountId)
  return { ok: true }
}

export async function removeFriend(db: AppDatabase, accountId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const row = await friendshipFor(db, id)
  if (!row || (row.requester_id !== accountId && row.addressee_id !== accountId)) return { error: "That friend is not yours." }
  if (row.status !== "accepted") return { error: "That request is still pending." }
  await db.run(
    "DELETE FROM friendships WHERE id = ? AND status = 'accepted' AND (requester_id = ? OR addressee_id = ?)",
    id,
    accountId,
    accountId,
  )
  return { ok: true }
}

export async function listFriendsBoard(
  db: AppDatabase,
  accountId: string,
  view: BoardView,
  now = Date.now(),
  limit = 100,
): Promise<BoardRow[]> {
  const start = periodStart(view, new Date(now))
  const where = `rolls.played_at <= ?
    AND (
      rolls.account_id = ?
      OR rolls.account_id IN (
        SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END
        FROM friendships
        WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)
      )
    )`
  const rows =
    start == null
      ? await db.all<{ username: string; word: string; score: string }>(
          `SELECT username, word, score FROM rolls WHERE ${where}
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
          now,
          accountId,
          accountId,
          accountId,
          accountId,
          limit,
        )
      : await db.all<{ username: string; word: string; score: string }>(
          `SELECT username, word, score FROM rolls WHERE played_at >= ? AND ${where}
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
          start,
          now,
          accountId,
          accountId,
          accountId,
          accountId,
          limit,
        )
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    word: row.word,
    score: row.score,
  }))
}
