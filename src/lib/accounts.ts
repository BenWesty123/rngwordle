import { randomBytes, randomUUID } from "node:crypto"
import type { AppDatabase } from "@/lib/sql"
import { utcDateKey } from "@/lib/day"

export const ANONYMOUS_NAME = "Anonymous"
export const LOGIN_LINK_MS = 30 * 60 * 1000
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE = "rngworlde_session"
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export type BoardView = "today" | "week" | "month" | "all"

export type SavedRoll = {
  username: string
  word: string
  score: string
  playedAt: number
  utcDay: string
}

export type BoardRow = {
  rank: number
  username: string
  word: string
  score: string
}

type AccountRow = {
  id: string
  email: string
  username: string | null
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (email.length < 3 || email.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export function normalizeUsername(value: string): string | null {
  const username = value.trim()
  if (!USERNAME_PATTERN.test(username)) return null
  return username
}

export function scoreDigits(total: number): string {
  if (!Number.isFinite(total) || total < 0) throw new Error("Score is not a usable total")
  const text = total.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 })
  if (!/^\d+$/.test(text)) throw new Error("Score is not a whole number")
  return text
}

export function formatScore(score: string): string {
  return score.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** Monday 00:00 UTC for week, the 1st 00:00 UTC for month, midnight UTC for today. */
export function periodStart(view: BoardView, now: Date): number | null {
  if (view === "all") return null
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const date = now.getUTCDate()
  if (view === "today") return Date.UTC(year, month, date)
  if (view === "month") return Date.UTC(year, month, 1)
  const daysSinceMonday = (now.getUTCDay() + 6) % 7
  return Date.UTC(year, month, date - daysSinceMonday)
}

export function parseBoardView(value: string | undefined): BoardView {
  if (value === "week" || value === "month" || value === "all" || value === "today") return value
  return "today"
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  return message.includes("UNIQUE") || message.includes("constraint")
}

export async function createLoginLink(
  db: AppDatabase,
  email: string,
  now = Date.now(),
): Promise<{ token: string } | { error: string }> {
  const normalized = normalizeEmail(email)
  if (!normalized) return { error: "Enter an email address." }
  const token = randomBytes(32).toString("base64url")
  let account = await db.get<{ id: string }>("SELECT id FROM accounts WHERE email = ?", normalized)
  if (!account) {
    const accountId = randomUUID()
    try {
      await db.run(
        "INSERT INTO accounts (id, email, username, username_key, created_at) VALUES (?, ?, NULL, NULL, ?)",
        accountId,
        normalized,
        now,
      )
      account = { id: accountId }
    } catch (error) {
      if (!isConstraintError(error)) throw error
      account = await db.get<{ id: string }>("SELECT id FROM accounts WHERE email = ?", normalized)
      if (!account) throw error
    }
  }
  await db.run(
    "INSERT INTO login_links (token, account_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)",
    token,
    account.id,
    now,
    now + LOGIN_LINK_MS,
  )
  return { token }
}

export async function consumeLoginLink(
  db: AppDatabase,
  token: string,
  now = Date.now(),
): Promise<{ accountId: string; username: string | null; sessionToken: string } | { error: "missing" | "used" | "expired" }> {
  const link = await db.get<{ account_id: string; expires_at: number; used_at: number | null }>(
    "SELECT account_id, expires_at, used_at FROM login_links WHERE token = ?",
    token,
  )
  if (!link) return { error: "missing" }
  if (link.used_at != null) return { error: "used" }
  if (link.expires_at < now) return { error: "expired" }
  const sessionToken = randomBytes(32).toString("base64url")
  const [updated] = await db.batch([
    {
      sql: "UPDATE login_links SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at >= ?",
      params: [now, token, now],
    },
    {
      sql: `INSERT INTO sessions (token, account_id, created_at, expires_at)
            SELECT ?, account_id, ?, ? FROM login_links WHERE token = ? AND used_at = ?`,
      params: [sessionToken, now, now + SESSION_MS, token, now],
    },
  ])
  if (!updated || updated.changes !== 1) {
    const again = await db.get<{ used_at: number | null; expires_at: number }>(
      "SELECT used_at, expires_at FROM login_links WHERE token = ?",
      token,
    )
    if (!again) return { error: "missing" }
    if (again.used_at != null) return { error: "used" }
    return { error: "expired" }
  }
  const account = await db.get<{ username: string | null }>("SELECT username FROM accounts WHERE id = ?", link.account_id)
  return { accountId: link.account_id, username: account?.username ?? null, sessionToken }
}

export async function accountForSession(db: AppDatabase, token: string, now = Date.now()): Promise<AccountRow | null> {
  return db.get<AccountRow>(
    `SELECT accounts.id, accounts.email, accounts.username
     FROM sessions
     JOIN accounts ON accounts.id = sessions.account_id
     WHERE sessions.token = ? AND sessions.expires_at >= ?`,
    token,
    now,
  )
}

export async function deleteSession(db: AppDatabase, token: string): Promise<void> {
  await db.run("DELETE FROM sessions WHERE token = ?", token)
}

export async function setUsername(
  db: AppDatabase,
  accountId: string,
  raw: string,
): Promise<{ username: string } | { error: string }> {
  const username = normalizeUsername(raw)
  if (!username) return { error: "Use 3 to 20 letters, numbers, or underscores." }
  const key = username.toLowerCase()
  try {
    const changed = await db.run(
      "UPDATE accounts SET username = ?, username_key = ? WHERE id = ? AND username IS NULL",
      username,
      key,
      accountId,
    )
    if (changed.changes === 0) {
      const current = await db.get<{ username: string | null }>("SELECT username FROM accounts WHERE id = ?", accountId)
      if (!current) return { error: "That account is gone." }
      if (current.username) return { error: "This account already has a username." }
      return { error: "That name is taken." }
    }
  } catch (error) {
    if (isConstraintError(error)) return { error: "That name is taken." }
    throw error
  }
  return { username }
}

export async function rollForDay(db: AppDatabase, accountId: string, utcDay: string): Promise<SavedRoll | null> {
  const row = await db.get<{ username: string; word: string; score: string; played_at: number; utc_day: string }>(
    "SELECT username, word, score, played_at, utc_day FROM rolls WHERE account_id = ? AND utc_day = ?",
    accountId,
    utcDay,
  )
  if (!row) return null
  return { username: row.username, word: row.word, score: row.score, playedAt: row.played_at, utcDay: row.utc_day }
}

export async function saveAnonymousRoll(
  db: AppDatabase,
  now: number,
  draw: () => { word: string; score: string },
): Promise<{ roll: SavedRoll; created: boolean } | { error: string }> {
  const drawn = draw()
  if (!/^[a-z]+$/.test(drawn.word) || !/^\d+$/.test(drawn.score)) return { error: "That roll could not be saved." }
  const utcDay = utcDateKey(new Date(now))
  await db.run(
    "INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day) VALUES (?, NULL, ?, ?, ?, ?, ?)",
    randomUUID(),
    ANONYMOUS_NAME,
    drawn.word,
    drawn.score,
    now,
    utcDay,
  )
  return {
    roll: { username: ANONYMOUS_NAME, word: drawn.word, score: drawn.score, playedAt: now, utcDay },
    created: true,
  }
}

export async function saveDailyRoll(
  db: AppDatabase,
  accountId: string,
  now: number,
  draw: () => { word: string; score: string },
): Promise<{ roll: SavedRoll; created: boolean } | { error: string }> {
  const account = await db.get<{ username: string | null }>("SELECT username FROM accounts WHERE id = ?", accountId)
  if (!account) return { error: "That account is gone." }
  const utcDay = utcDateKey(new Date(now))
  const existing = await rollForDay(db, accountId, utcDay)
  if (existing) return { roll: existing, created: false }
  const drawn = draw()
  if (!/^[a-z]+$/.test(drawn.word) || !/^\d+$/.test(drawn.score)) return { error: "That roll could not be saved." }
  const username = account.username ?? ANONYMOUS_NAME
  try {
    await db.run(
      "INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day) VALUES (?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      accountId,
      username,
      drawn.word,
      drawn.score,
      now,
      utcDay,
    )
  } catch (error) {
    const saved = await rollForDay(db, accountId, utcDay)
    if (saved && isConstraintError(error)) return { roll: saved, created: false }
    if (saved) return { roll: saved, created: false }
    throw error
  }
  const saved = await rollForDay(db, accountId, utcDay)
  if (!saved) return { error: "That roll could not be saved." }
  return { roll: saved, created: true }
}

export async function listBoard(db: AppDatabase, view: BoardView, now = Date.now(), limit = 100): Promise<BoardRow[]> {
  const start = periodStart(view, new Date(now))
  const rows =
    start == null
      ? await db.all<{ username: string; word: string; score: string }>(
          `SELECT username, word, score
           FROM rolls
           WHERE played_at <= ?
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
          now,
          limit,
        )
      : await db.all<{ username: string; word: string; score: string }>(
          `SELECT username, word, score
           FROM rolls
           WHERE played_at >= ? AND played_at <= ?
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
          start,
          now,
          limit,
        )
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    word: row.word,
    score: row.score,
  }))
}
