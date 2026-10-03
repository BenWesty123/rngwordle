import { SHARE_CHANNELS, type ShareChannel } from "@/lib/counters"
import { utcDateKey } from "@/lib/day"
import type { AppDatabase } from "@/lib/sql"

export type DayStats = {
  day: string
  rolls: number
  playerRolls: number
  guestRolls: number
  /** Accounts that rolled. */
  players: number
  /** Guest browsers that made their leaderboard roll. */
  guests: number
  practice: number
  /** Someone asked for a login link with a new email. */
  signups: number
  /** ...and later picked a username. */
  named: number
  shares: number
  channels: Record<ShareChannel, number>
  sharedViews: number
  sharedRolls: number
}

export type Stats = {
  days: DayStats[]
  totals: { accounts: number; named: number; rolls: number; friendships: number }
}

const DAY_MS = 24 * 60 * 60 * 1000

function emptyDay(day: string): DayStats {
  return {
    day,
    rolls: 0,
    playerRolls: 0,
    guestRolls: 0,
    players: 0,
    guests: 0,
    practice: 0,
    signups: 0,
    named: 0,
    shares: 0,
    channels: Object.fromEntries(SHARE_CHANNELS.map((channel) => [channel, 0])) as Record<ShareChannel, number>,
    sharedViews: 0,
    sharedRolls: 0,
  }
}

/** The last `count` UTC days, newest first. */
export async function loadStats(db: AppDatabase, now = Date.now(), count = 14): Promise<Stats> {
  const days = Array.from({ length: count }, (_, index) => utcDateKey(new Date(now - index * DAY_MS)))
  const first = days[days.length - 1]!
  const byDay = new Map(days.map((day) => [day, emptyDay(day)]))
  const firstMs = Date.parse(`${first}T00:00:00.000Z`)

  const [rolls, guests, accounts, counts, totals] = await Promise.all([
    db.all<{ utc_day: string; rolls: number; player_rolls: number; players: number }>(
      `SELECT utc_day, count(*) AS rolls, sum(account_id IS NOT NULL) AS player_rolls, count(DISTINCT account_id) AS players
       FROM rolls WHERE utc_day >= ? GROUP BY utc_day`,
      first,
    ),
    db.all<{ utc_day: string; guests: number }>(
      "SELECT utc_day, count(*) AS guests FROM guest_days WHERE utc_day >= ? GROUP BY utc_day",
      first,
    ),
    db.all<{ day: string; signups: number; named: number }>(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, count(*) AS signups, sum(username IS NOT NULL) AS named
       FROM accounts WHERE created_at >= ? GROUP BY day`,
      firstMs,
    ),
    db.all<{ utc_day: string; name: string; count: number }>(
      "SELECT utc_day, name, count FROM daily_counts WHERE utc_day >= ?",
      first,
    ),
    db.get<{ accounts: number; named: number; rolls: number; friendships: number }>(
      `SELECT (SELECT count(*) FROM accounts) AS accounts,
              (SELECT count(*) FROM accounts WHERE username IS NOT NULL) AS named,
              (SELECT count(*) FROM rolls) AS rolls,
              (SELECT count(*) FROM friendships WHERE status = 'accepted') AS friendships`,
    ),
  ])

  for (const row of rolls) {
    const day = byDay.get(row.utc_day)
    if (!day) continue
    day.rolls = Number(row.rolls)
    day.playerRolls = Number(row.player_rolls)
    day.guestRolls = day.rolls - day.playerRolls
    day.players = Number(row.players)
  }
  for (const row of guests) {
    const day = byDay.get(row.utc_day)
    if (day) day.guests = Number(row.guests)
  }
  for (const row of accounts) {
    const day = byDay.get(row.day)
    if (!day) continue
    day.signups = Number(row.signups)
    day.named = Number(row.named)
  }
  for (const row of counts) {
    const day = byDay.get(row.utc_day)
    if (!day) continue
    const value = Number(row.count)
    if (row.name === "practice_roll") day.practice = value
    else if (row.name === "shared_link_view") day.sharedViews = value
    else if (row.name === "shared_link_roll") day.sharedRolls = value
    else if (row.name.startsWith("share:")) {
      const channel = row.name.slice("share:".length) as ShareChannel
      if (channel in day.channels) {
        day.channels[channel] = value
        day.shares += value
      }
    }
  }

  return {
    days: days.map((day) => byDay.get(day)!),
    totals: {
      accounts: Number(totals?.accounts ?? 0),
      named: Number(totals?.named ?? 0),
      rolls: Number(totals?.rolls ?? 0),
      friendships: Number(totals?.friendships ?? 0),
    },
  }
}
