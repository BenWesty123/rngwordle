import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { canSeeStats } from "@/lib/config"
import { SHARE_CHANNELS, type ShareChannel } from "@/lib/counters"
import { currentAccount } from "@/lib/current-account"
import { loadStats, type DayStats } from "@/lib/stats"
import { cn } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Stats · RWGdle", robots: { index: false, follow: false } }

const CHANNEL_NAMES: Record<ShareChannel, string> = {
  native: "Phone share menu",
  whatsapp: "WhatsApp",
  discord: "Discord",
  x: "X",
  telegram: "Telegram",
  copy: "Copy",
}

const n = (value: number) => value.toLocaleString("en-US")

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00.000Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
}

function Delta({ today, yesterday }: { today: number; yesterday: number }) {
  if (today === yesterday) return <span className="text-muted-foreground">same as yesterday</span>
  const up = today > yesterday
  return (
    <span className={up ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
      {up ? "▲" : "▼"} {n(Math.abs(today - yesterday))} vs yesterday
    </span>
  )
}

function Tile({ label, today, yesterday, hint }: { label: string; today: number; yesterday: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl leading-none tabular-nums">{n(today)}</p>
      <p className="mt-2 text-xs">
        <Delta today={today} yesterday={yesterday} />
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl tracking-tight italic">{title}</h2>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-secondary">
      <div className={cn("h-full rounded-full", className ?? "bg-primary")} style={{ width: `${width}%` }} />
    </div>
  )
}

/** rwgdle.app/stats: private. Anyone not on STATS_USERNAMES gets a plain "not found". */
export default async function StatsPage() {
  const account = await currentAccount()
  if (!(await canSeeStats(account?.username))) notFound()

  const { days, totals } = await loadStats(await appDb())
  const [today, yesterday] = [days[0]!, days[1]!]
  const week = days.slice(0, 7)
  const sum = (pick: (day: DayStats) => number, list = week) => list.reduce((total, day) => total + pick(day), 0)
  const maxRolls = Math.max(...days.map((day) => day.rolls), 1)
  const channels = SHARE_CHANNELS.map((channel) => ({ channel, count: sum((day) => day.channels[channel]) })).sort(
    (left, right) => right.count - left.count,
  )
  const maxChannel = Math.max(...channels.map((entry) => entry.count), 1)
  const weekViews = sum((day) => day.sharedViews)
  const weekShareRolls = sum((day) => day.sharedRolls)

  return (
    <div className="relative min-h-dvh">
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl">
          <div className="mt-10 text-center">
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Private · only you can see this</p>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Stats</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-pretty text-muted-foreground">
              Days are UTC. Today is {dayLabel(today.day)}. Guest counts started on 2 October 2026, and share and visit counts on 3 October, so earlier days show rolls without people.
            </p>
          </div>

          <Section title="Today">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Rolls" today={today.rolls} yesterday={yesterday.rolls} hint={`${n(today.playerRolls)} players · ${n(today.guestRolls)} guests`} />
              <Tile label="People who rolled" today={today.players + today.guests} yesterday={yesterday.players + yesterday.guests} hint={`${n(today.players)} logged in · ${n(today.guests)} guests`} />
              <Tile label="New sign-ups" today={today.signups} yesterday={yesterday.signups} hint={`${n(today.named)} picked a username`} />
              <Tile label="Shares" today={today.shares} yesterday={yesterday.shares} />
              <Tile
                label="Shared-link visits"
                today={today.sharedViews}
                yesterday={yesterday.sharedViews}
                hint={`${n(today.sharedRolls)} went on to roll`}
              />
            </div>
          </Section>

          <Section
            title="Is sharing working?"
            note="Last 7 days. A visit is someone opening a friend's shared link; a roll is that visitor then rolling their own word."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
                <p className="text-xs text-muted-foreground">Shares</p>
                <p className="mt-1 font-mono text-3xl tabular-nums">{n(sum((day) => day.shares))}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
                <p className="text-xs text-muted-foreground">Shared-link visits</p>
                <p className="mt-1 font-mono text-3xl tabular-nums">{n(weekViews)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
                <p className="text-xs text-muted-foreground">Visitors who rolled</p>
                <p className="mt-1 font-mono text-3xl tabular-nums">
                  {n(weekShareRolls)}
                  <span className="ml-2 text-base text-muted-foreground">
                    {weekViews > 0 ? `${Math.round((weekShareRolls / weekViews) * 100)}%` : "–"}
                  </span>
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {channels.map(({ channel, count }) => (
                <li key={channel} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                  <span>{CHANNEL_NAMES[channel]}</span>
                  <Bar value={count} max={maxChannel} />
                  <span className="text-right font-mono tabular-nums">{n(count)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Last 14 days">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[42rem] text-sm">
                <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Rolls</th>
                    <th className="w-40 px-3 py-2 font-medium" />
                    <th className="px-3 py-2 text-right font-medium">People</th>
                    <th className="px-3 py-2 text-right font-medium">Sign-ups</th>
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                    <th className="px-3 py-2 text-right font-medium">Link visits</th>
                    <th className="px-3 py-2 text-right font-medium">Rolled from links</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {days.map((day, index) => (
                    <tr key={day.day} className={cn("border-t border-border", index === 0 && "bg-primary/5")}>
                      <td className="px-3 py-2 font-sans whitespace-nowrap">{dayLabel(day.day)}</td>
                      <td className="px-3 py-2">{n(day.rolls)}</td>
                      <td className="px-3 py-2">
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-primary" style={{ width: `${(day.rolls / maxRolls) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{n(day.players + day.guests)}</td>
                      <td className="px-3 py-2 text-right">{n(day.signups)}</td>
                      <td className="px-3 py-2 text-right">{n(day.shares)}</td>
                      <td className="px-3 py-2 text-right">{n(day.sharedViews)}</td>
                      <td className="px-3 py-2 text-right">{n(day.sharedRolls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="All time">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Accounts", totals.accounts],
                ["With a username", totals.named],
                ["Saved rolls", totals.rolls],
                ["Friendships", totals.friendships],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-card px-4 py-3.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono text-2xl tabular-nums">{n(Number(value))}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Accounts include anyone who asked for a login link, even if they never used it.
            </p>
          </Section>
        </main>
      </div>
    </div>
  )
}
