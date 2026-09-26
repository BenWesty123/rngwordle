import { randomBytes, randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { getDb } from "@/lib/db"
import { utcDateKey } from "@/lib/day"

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

function withTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const value = run()
    db.exec("COMMIT")
    return value
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function createLoginLink(db: DatabaseSync, email: string, now = Date.now()): { token: string } | { error: string } {
  const normalized = normalizeEmail(email)
  if (!normalized) return { error: "Enter an email address." }
  const token = randomBytes(32).toString("base64url")
  withTransaction(db, () => {
    const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(normalized) as { id: string } | undefined
    const accountId = existing?.id ?? randomUUID()
    if (!existing) {
      db.prepare("INSERT INTO accounts (id, email, username, username_key, created_at) VALUES (?, ?, NULL, NULL, ?)").run(
        accountId,
        normalized,
        now,
      )
    }
    db.prepare("INSERT INTO login_links (token, account_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)").run(
      token,
      accountId,
      now,
      now + LOGIN_LINK_MS,
    )
  })
  return { token }
}

export function consumeLoginLink(
  db: DatabaseSync,
  token: string,
  now = Date.now(),
): { accountId: string; username: string | null; sessionToken: string } | { error: "missing" | "used" | "expired" } {
  const link = db.prepare(
    "SELECT account_id, expires_at, used_at FROM login_links WHERE token = ?",
  ).get(token) as { account_id: string; expires_at: number; used_at: number | null } | undefined
  if (!link) return { error: "missing" }
  if (link.used_at != null) return { error: "used" }
  if (link.expires_at < now) return { error: "expired" }
  const sessionToken = randomBytes(32).toString("base64url")
  try {
    withTransaction(db, () => {
      const current = db.prepare("SELECT used_at FROM login_links WHERE token = ?").get(token) as
        | { used_at: number | null }
        | undefined
      if (!current || current.used_at != null) throw new Error("used")
      db.prepare("UPDATE login_links SET used_at = ? WHERE token = ?").run(now, token)
      db.prepare("INSERT INTO sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
        sessionToken,
        link.account_id,
        now,
        now + SESSION_MS,
      )
    })
  } catch (error) {
    if (error instanceof Error && error.message === "used") return { error: "used" }
    throw error
  }
  const account = db.prepare("SELECT username FROM accounts WHERE id = ?").get(link.account_id) as { username: string | null }
  return { accountId: link.account_id, username: account.username, sessionToken }
}

export function accountForSession(db: DatabaseSync, token: string, now = Date.now()): AccountRow | null {
  const row = db.prepare(
    `SELECT accounts.id, accounts.email, accounts.username
     FROM sessions
     JOIN accounts ON accounts.id = sessions.account_id
     WHERE sessions.token = ? AND sessions.expires_at >= ?`,
  ).get(token, now) as AccountRow | undefined
  return row ?? null
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token)
}

export function setUsername(
  db: DatabaseSync,
  accountId: string,
  raw: string,
): { username: string } | { error: string } {
  const username = normalizeUsername(raw)
  if (!username) return { error: "Use 3 to 20 letters, numbers, or underscores." }
  const key = username.toLowerCase()
  try {
    const changed = db.prepare(
      "UPDATE accounts SET username = ?, username_key = ? WHERE id = ? AND username IS NULL",
    ).run(username, key, accountId)
    if (Number(changed.changes) === 0) {
      const current = db.prepare("SELECT username FROM accounts WHERE id = ?").get(accountId) as
        | { username: string | null }
        | undefined
      if (!current) return { error: "That account is gone." }
      if (current.username) return { error: "This account already has a username." }
      return { error: "That name is taken." }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("UNIQUE") || message.includes("constraint")) return { error: "That name is taken." }
    throw error
  }
  return { username }
}

export function rollForDay(db: DatabaseSync, accountId: string, utcDay: string): SavedRoll | null {
  const row = db.prepare(
    "SELECT username, word, score, played_at, utc_day FROM rolls WHERE account_id = ? AND utc_day = ?",
  ).get(accountId, utcDay) as
    | { username: string; word: string; score: string; played_at: number; utc_day: string }
    | undefined
  if (!row) return null
  return { username: row.username, word: row.word, score: row.score, playedAt: row.played_at, utcDay: row.utc_day }
}

export function saveDailyRoll(
  db: DatabaseSync,
  accountId: string,
  now: number,
  draw: () => { word: string; score: string },
): { roll: SavedRoll; created: boolean } | { error: string } {
  const account = db.prepare("SELECT username FROM accounts WHERE id = ?").get(accountId) as
    | { username: string | null }
    | undefined
  if (!account?.username) return { error: "Choose a username first." }
  const utcDay = utcDateKey(new Date(now))
  const existing = rollForDay(db, accountId, utcDay)
  if (existing) return { roll: existing, created: false }
  const drawn = draw()
  if (!/^[a-z]+$/.test(drawn.word) || !/^\d+$/.test(drawn.score)) return { error: "That roll could not be saved." }
  try {
    withTransaction(db, () => {
      const again = rollForDay(db, accountId, utcDay)
      if (again) throw new Error("exists")
      db.prepare(
        "INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(randomUUID(), accountId, account.username, drawn.word, drawn.score, now, utcDay)
    })
  } catch (error) {
    const saved = rollForDay(db, accountId, utcDay)
    if (saved) return { roll: saved, created: false }
    const message = error instanceof Error ? error.message : ""
    if (message === "exists") {
      const raced = rollForDay(db, accountId, utcDay)
      if (raced) return { roll: raced, created: false }
    }
    throw error
  }
  const saved = rollForDay(db, accountId, utcDay)
  if (!saved) return { error: "That roll could not be saved." }
  return { roll: saved, created: true }
}

export function listBoard(db: DatabaseSync, view: BoardView, now = Date.now(), limit = 100): BoardRow[] {
  const start = periodStart(view, new Date(now))
  const rows = (
    start == null
      ? db.prepare(
          `SELECT username, word, score
           FROM rolls
           WHERE played_at <= ?
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
        ).all(now, limit)
      : db.prepare(
          `SELECT username, word, score
           FROM rolls
           WHERE played_at >= ? AND played_at <= ?
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
        ).all(start, now, limit)
  ) as Array<{ username: string; word: string; score: string }>
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    word: row.word,
    score: row.score,
  }))
}

export function appDb(): DatabaseSync {
  return getDb()
}
