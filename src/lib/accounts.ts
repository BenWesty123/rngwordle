import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { AppDatabase } from "@/lib/sql"
import { utcDateKey } from "@/lib/day"

export const ANONYMOUS_NAME = "Anonymous"
export const LOGIN_LINK_MS = 30 * 60 * 1000
/** Skip another login email to the same address inside this window. */
export const LOGIN_RESEND_MS = 60 * 1000
/** A year. Playing renews it, so a regular player never has to log in again. */
export const SESSION_MS = 365 * 24 * 60 * 60 * 1000
/** Renew a session at most once a day. */
const SESSION_RENEW_MS = 24 * 60 * 60 * 1000
export const LOGIN_WAIT_COOKIE = "rngworlde_login_wait"
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

export type TotalsView = "week" | "month"

export type TotalsRow = {
  rank: number
  username: string
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

export function parseTotalsView(value: string | undefined): TotalsView {
  if (value === "month") return "month"
  return "week"
}

/** Digit-string addition. Scores can outgrow a JS number, so the sum stays a string. */
export function addScoreDigits(left: string, right: string): string {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) throw new Error("Score is not a whole number")
  let carry = 0
  let i = left.length - 1
  let j = right.length - 1
  let out = ""
  while (i >= 0 || j >= 0 || carry > 0) {
    const a = i >= 0 ? left.charCodeAt(i) - 48 : 0
    const b = j >= 0 ? right.charCodeAt(j) - 48 : 0
    const sum = a + b + carry
    out = String(sum % 10) + out
    carry = Math.floor(sum / 10)
    i -= 1
    j -= 1
  }
  return out.replace(/^0+(?=\d)/, "")
}

function compareScoreDigits(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function rankScoreTotals(
  rows: Array<{ accountId: string; username: string; score: string; playedAt: number }>,
  limit = 100,
): TotalsRow[] {
  const totals = new Map<string, { username: string; score: string; latest: number }>()
  for (const row of rows) {
    const current = totals.get(row.accountId)
    if (!current) {
      totals.set(row.accountId, { username: row.username, score: row.score, latest: row.playedAt })
      continue
    }
    current.score = addScoreDigits(current.score, row.score)
    if (row.playedAt >= current.latest) current.latest = row.playedAt
  }
  const ranked = [...totals.values()].sort((a, b) => {
    const byScore = compareScoreDigits(b.score, a.score)
    if (byScore !== 0) return byScore
    if (a.latest !== b.latest) return a.latest - b.latest
    return a.username < b.username ? -1 : a.username > b.username ? 1 : 0
  })
  return ranked.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    username: row.username,
    score: row.score,
  }))
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

/** Milliseconds until another link can be sent to this address, or 0. */
export async function loginResendWait(db: AppDatabase, email: string, now = Date.now()): Promise<number> {
  const normalized = normalizeEmail(email)
  if (!normalized) return 0
  const row = await db.get<{ created_at: number }>(
    `SELECT login_links.created_at AS created_at
     FROM login_links
     JOIN accounts ON accounts.id = login_links.account_id
     WHERE accounts.email = ?
     ORDER BY login_links.created_at DESC
     LIMIT 1`,
    normalized,
  )
  if (!row) return 0
  return Math.max(0, row.created_at + LOGIN_RESEND_MS - now)
}

export async function loginLinkSentRecently(db: AppDatabase, email: string, now = Date.now()): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const row = await db.get<{ created_at: number }>(
    `SELECT login_links.created_at AS created_at
     FROM login_links
     JOIN accounts ON accounts.id = login_links.account_id
     WHERE accounts.email = ?
     ORDER BY login_links.created_at DESC
     LIMIT 1`,
    normalized,
  )
  if (!row) return false
  return now - row.created_at < LOGIN_RESEND_MS
}

export async function deleteLoginLink(db: AppDatabase, token: string): Promise<void> {
  await db.run("DELETE FROM login_links WHERE token = ?", token)
}

/** Read a login link without using it. A GET from a mail scanner must leave the row unused. */
export async function loginLinkState(
  db: AppDatabase,
  token: string,
  now = Date.now(),
): Promise<"ok" | "missing" | "used" | "expired"> {
  if (!token) return "missing"
  const link = await db.get<{ expires_at: number; used_at: number | null }>(
    "SELECT expires_at, used_at FROM login_links WHERE token = ?",
    token,
  )
  if (!link) return "missing"
  if (link.used_at != null) return "used"
  if (link.expires_at < now) return "expired"
  return "ok"
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

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url")
}

/**
 * The tab that asked for a login link waits on this. Tapping the link approves it,
 * so that tab logs in too, even when the link opened in another app or device.
 * Only a hash of the secret is stored.
 */
export async function createLoginWait(
  db: AppDatabase,
  linkToken: string,
  device: string,
  now = Date.now(),
): Promise<string> {
  const secret = randomBytes(32).toString("base64url")
  await db.run(
    "INSERT INTO login_waits (wait_hash, link_token, device, created_at, expires_at, approved_at, claimed_at) VALUES (?, ?, ?, ?, ?, NULL, NULL)",
    hashSecret(secret),
    linkToken,
    device.slice(0, 80),
    now,
    now + LOGIN_LINK_MS,
  )
  return secret
}

/** The device that asked for this link, for the confirm screen. */
export async function loginWaitFor(
  db: AppDatabase,
  linkToken: string,
): Promise<{ device: string; createdAt: number; waitHash: string } | null> {
  const row = await db.get<{ device: string; created_at: number; wait_hash: string }>(
    "SELECT device, created_at, wait_hash FROM login_waits WHERE link_token = ? ORDER BY created_at DESC LIMIT 1",
    linkToken,
  )
  return row ? { device: row.device, createdAt: row.created_at, waitHash: row.wait_hash } : null
}

/** True when this wait secret belongs to the link, so the browser that asked is the one opening it. */
export async function isOwnLoginWait(db: AppDatabase, linkToken: string, secret: string | undefined): Promise<boolean> {
  if (!secret) return false
  const row = await db.get<{ link_token: string }>(
    "SELECT link_token FROM login_waits WHERE wait_hash = ?",
    hashSecret(secret),
  )
  return row?.link_token === linkToken
}

/**
 * The link was used: approve the tab waiting on it. When the same browser opened
 * the link, it already has the session, so its wait is marked claimed instead.
 */
export async function approveLoginWaits(
  db: AppDatabase,
  linkToken: string,
  ownSecret: string | undefined,
  now = Date.now(),
): Promise<void> {
  await db.run("UPDATE login_waits SET approved_at = ? WHERE link_token = ? AND approved_at IS NULL", now, linkToken)
  if (ownSecret) {
    await db.run(
      "UPDATE login_waits SET claimed_at = ? WHERE wait_hash = ? AND link_token = ? AND claimed_at IS NULL",
      now,
      hashSecret(ownSecret),
      linkToken,
    )
  }
}

/**
 * The waiting tab checks in. Once the link is used it gets its own session, once.
 * "done" with no session means this browser already has one from opening the link.
 */
export async function claimLoginWait(
  db: AppDatabase,
  secret: string,
  now = Date.now(),
): Promise<{ status: "waiting" | "expired" } | { status: "done"; sessionToken: string | null }> {
  const waitHash = hashSecret(secret)
  const wait = await db.get<{ link_token: string; expires_at: number; approved_at: number | null; claimed_at: number | null }>(
    "SELECT link_token, expires_at, approved_at, claimed_at FROM login_waits WHERE wait_hash = ?",
    waitHash,
  )
  if (!wait) return { status: "expired" }
  if (wait.claimed_at != null) return { status: "done", sessionToken: null }
  if (wait.approved_at == null) return { status: wait.expires_at < now ? "expired" : "waiting" }
  const sessionToken = randomBytes(32).toString("base64url")
  const [claimed] = await db.batch([
    {
      sql: "UPDATE login_waits SET claimed_at = ? WHERE wait_hash = ? AND claimed_at IS NULL AND approved_at IS NOT NULL",
      params: [now, waitHash],
    },
    {
      sql: `INSERT INTO sessions (token, account_id, created_at, expires_at)
            SELECT ?, login_links.account_id, ?, ?
            FROM login_waits JOIN login_links ON login_links.token = login_waits.link_token
            WHERE login_waits.wait_hash = ? AND login_waits.claimed_at = ?`,
      params: [sessionToken, now, now + SESSION_MS, waitHash, now],
    },
  ])
  if (!claimed || claimed.changes !== 1) return { status: "done", sessionToken: null }
  return { status: "done", sessionToken }
}

/** Push a session's expiry a year out, at most once a day. True when it moved. */
export async function renewSession(db: AppDatabase, token: string, now = Date.now()): Promise<boolean> {
  const result = await db.run(
    "UPDATE sessions SET expires_at = ? WHERE token = ? AND expires_at >= ? AND expires_at < ?",
    now + SESSION_MS,
    token,
    now,
    now + SESSION_MS - SESSION_RENEW_MS,
  )
  return result.changes === 1
}

/** "Chrome on Windows", from a user agent, for the login confirm screen. */
export function describeDevice(userAgent: string | null): string {
  const agent = userAgent ?? ""
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : "A browser"
  const system = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Mac OS X|Macintosh/.test(agent)
          ? "Mac"
          : /Windows/.test(agent)
            ? "Windows"
            : /Linux/.test(agent)
              ? "Linux"
              : null
  return system ? `${browser} on ${system}` : browser
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

/** Every word this account has rolled, oldest first. One a day, so the list stays short. */
export async function listRollWords(db: AppDatabase, accountId: string): Promise<string[]> {
  const rows = await db.all<{ word: string }>(
    "SELECT word FROM rolls WHERE account_id = ? ORDER BY played_at ASC",
    accountId,
  )
  return rows.map((row) => row.word)
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

export const GUEST_COOKIE = "rngworlde_guest"
/** A guest gets this many leaderboard rolls per login-free browser per UTC day. */
const GUEST_DAILY_ROLLS = 1

function guestHash(secret: string): string {
  return createHash("sha256").update(`guest:${secret}`).digest("base64url")
}

export function newGuestSecret(): string {
  return randomBytes(24).toString("base64url")
}

/**
 * A logged-out roll. The first one each UTC day goes on the leaderboard as Anonymous.
 * After that the browser gets practice rolls: dealt and scored, but not saved.
 */
export async function saveGuestRoll(
  db: AppDatabase,
  guestSecret: string,
  now: number,
  draw: () => { word: string; score: string },
): Promise<{ roll: SavedRoll; created: boolean; practice: boolean } | { error: string }> {
  const drawn = draw()
  if (!/^[a-z]+$/.test(drawn.word) || !/^\d+$/.test(drawn.score)) return { error: "That roll could not be saved." }
  const utcDay = utcDateKey(new Date(now))
  const roll = { username: ANONYMOUS_NAME, word: drawn.word, score: drawn.score, playedAt: now, utcDay }
  const hash = guestHash(guestSecret)
  const used = await db.get<{ n: number }>(
    "SELECT count(*) AS n FROM guest_days WHERE guest_hash = ? AND utc_day = ?",
    hash,
    utcDay,
  )
  if ((used?.n ?? 0) >= GUEST_DAILY_ROLLS) return { roll, created: false, practice: true }
  const rollId = randomUUID()
  try {
    // One transaction: the day's slot and the roll land together, or not at all.
    await db.batch([
      { sql: "INSERT INTO guest_days (guest_hash, utc_day, roll_id) VALUES (?, ?, ?)", params: [hash, utcDay, rollId] },
      {
        sql: "INSERT INTO rolls (id, account_id, username, word, score, played_at, utc_day) VALUES (?, NULL, ?, ?, ?, ?, ?)",
        params: [rollId, ANONYMOUS_NAME, drawn.word, drawn.score, now, utcDay],
      },
    ])
  } catch (error) {
    // Two tabs rolled at once: the other one took today's slot.
    if (isConstraintError(error)) return { roll, created: false, practice: true }
    throw error
  }
  return { roll, created: true, practice: false }
}

/** Login emails one visitor may ask for per UTC day, across every address. */
export const LOGIN_REQUESTS_PER_DAY = 30

/** Count a login request from this visitor. False once today's allowance is used up. */
export async function allowLoginRequest(db: AppDatabase, visitor: string, now = Date.now()): Promise<boolean> {
  const hash = createHash("sha256").update(`login:${visitor}`).digest("base64url")
  const utcDay = utcDateKey(new Date(now))
  const row = await db.get<{ count: number }>(
    "SELECT count FROM login_requests WHERE ip_hash = ? AND utc_day = ?",
    hash,
    utcDay,
  )
  if ((row?.count ?? 0) >= LOGIN_REQUESTS_PER_DAY) return false
  await db.run(
    `INSERT INTO login_requests (ip_hash, utc_day, count) VALUES (?, ?, 1)
     ON CONFLICT (ip_hash, utc_day) DO UPDATE SET count = count + 1`,
    hash,
    utcDay,
  )
  return true
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
    view === "today"
      ? await db.all<{ username: string; word: string; score: string }>(
          `SELECT username, word, score
           FROM rolls
           WHERE utc_day = ? AND played_at <= ?
           ORDER BY length(score) DESC, score DESC, played_at ASC
           LIMIT ?`,
          utcDateKey(new Date(now)),
          now,
          limit,
        )
      : start == null
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
           FROM rolls INDEXED BY rolls_rank
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

const TOTALS_ROLLS = `SELECT rolls.account_id AS account_id, accounts.username AS username, rolls.score AS score, rolls.played_at AS played_at
  FROM rolls
  JOIN accounts ON accounts.id = rolls.account_id
  WHERE accounts.username IS NOT NULL
    AND rolls.played_at >= ? AND rolls.played_at <= ?`

export async function listTotals(db: AppDatabase, view: TotalsView, now = Date.now(), limit = 100): Promise<TotalsRow[]> {
  const start = periodStart(view, new Date(now))
  const rows = await db.all<{ account_id: string; username: string; score: string; played_at: number }>(
    TOTALS_ROLLS,
    start ?? 0,
    now,
  )
  return rankScoreTotals(
    rows.map((row) => ({
      accountId: row.account_id,
      username: row.username,
      score: row.score,
      playedAt: row.played_at,
    })),
    limit,
  )
}
