import { utcDateKey } from "@/lib/day"
import type { AppDatabase } from "@/lib/sql"

/** Share buttons, by channel. */
export const SHARE_CHANNELS = ["native", "whatsapp", "discord", "x", "telegram", "copy"] as const
export type ShareChannel = (typeof SHARE_CHANNELS)[number]

/** Counters the browser may report. Everything else is counted on the server. */
export const CLIENT_COUNTERS = [...SHARE_CHANNELS.map((channel) => `share:${channel}` as const), "shared_link_view"] as const
export type ClientCounter = (typeof CLIENT_COUNTERS)[number]

export type Counter = ClientCounter | "practice_roll" | "shared_link_roll"

export function isClientCounter(name: string): name is ClientCounter {
  return (CLIENT_COUNTERS as readonly string[]).includes(name)
}

/** Add one to today's count. Anonymous: just the day, the name, and the total. */
export async function bumpCounter(db: AppDatabase, name: Counter, now = Date.now()): Promise<void> {
  await db.run(
    `INSERT INTO daily_counts (utc_day, name, count) VALUES (?, ?, 1)
     ON CONFLICT (utc_day, name) DO UPDATE SET count = count + 1`,
    utcDateKey(new Date(now)),
    name,
  )
}
