import Link from "next/link"
import { LoginPrompt } from "@/components/login-dialog"
import { SiteHeader } from "@/components/site-header"
import { TileBox } from "@/components/tile"
import { appDb } from "@/lib/app-db"
import { formatScore, listBoard, listTotals, parseBoardView, parseTotalsView, type BoardRow, type BoardView, type TotalsRow, type TotalsView } from "@/lib/accounts"
import { currentAccount } from "@/lib/current-account"
import { listFriendships, listFriendsBoard, listFriendTotals } from "@/lib/friends"
import { standingFor } from "@/lib/standing"
import { TIER_STYLE } from "@/lib/tier-style"
import { tilesFor } from "@/lib/tiles"
import { cn } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROLL_VIEWS: Array<{ id: BoardView; label: string; empty: string; note: string }> = [
  { id: "today", label: "Today", empty: "No saved rolls yet today.", note: "UTC day, so far." },
  { id: "week", label: "This week", empty: "No saved rolls this week.", note: "Monday 00:00 UTC through now." },
  { id: "month", label: "This month", empty: "No saved rolls this month.", note: "This calendar month, UTC." },
  { id: "all", label: "All time", empty: "No saved rolls yet.", note: "Every saved roll." },
]

const TOTAL_VIEWS: Array<{ id: TotalsView; label: string; empty: string; note: string }> = [
  { id: "week", label: "This week", empty: "No totals this week.", note: "Monday 00:00 UTC through now." },
  { id: "month", label: "This month", empty: "No totals this month.", note: "This calendar month, UTC." },
]

const MEDALS = [
  { ring: "from-amber-100 via-amber-300 to-amber-500", card: "border-amber-500/50 shadow-[0_0_40px_-12px_rgba(217,119,6,0.4)] dark:border-amber-200/50 dark:shadow-[0_0_40px_-12px_rgba(252,211,77,0.45)]", label: "1st" },
  { ring: "from-zinc-100 via-zinc-300 to-zinc-500", card: "border-zinc-400/50 dark:border-zinc-300/35", label: "2nd" },
  { ring: "from-orange-200 via-orange-400 to-orange-700", card: "border-orange-400/50 dark:border-orange-300/35", label: "3rd" },
] as const

function boardHref(totals: boolean, view: string, friends: boolean): string {
  const params = new URLSearchParams()
  if (totals) params.set("board", "totals")
  if (friends) params.set("scope", "friends")
  const defaultView = totals ? "week" : "today"
  if (view !== defaultView) params.set("view", view)
  const query = params.toString()
  return query ? `/leaderboard?${query}` : "/leaderboard"
}

function Segmented({ label, items }: { label: string; items: Array<{ href: string; text: string; selected: boolean }> }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card/70 p-1" role="tablist" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href + item.text}
          href={item.href}
          role="tab"
          aria-selected={item.selected}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
            item.selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.text}
        </Link>
      ))}
    </div>
  )
}

function Medal({ place, className }: { place: number; className?: string }) {
  const medal = MEDALS[place]!
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br font-mono text-sm font-bold text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_rgba(0,0,0,0.4)]",
        medal.ring,
        className,
      )}
      aria-label={`${medal.label} place`}
    >
      {place + 1}
    </span>
  )
}

function TierBadge({ score, small = false }: { score: string; small?: boolean }) {
  const tier = standingFor(Number(score)).tier
  return (
    <span
      className={cn(
        "inline-flex rounded-full border uppercase",
        small ? "px-1.5 py-px text-[9px] tracking-[0.16em]" : "px-2.5 py-0.5 text-[10px] tracking-[0.22em]",
        TIER_STYLE[tier.id].badge,
      )}
    >
      {tier.label}
    </span>
  )
}

function YouChip() {
  return <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-px align-middle text-[10px] font-medium text-amber-800 dark:bg-amber-200/20 dark:text-amber-100">You</span>
}

function RollPodium({ rows, me }: { rows: BoardRow[]; me: string | null }) {
  const [first, ...rest] = rows
  if (!first) return null
  const tiles = tilesFor(first.word)
  return (
    <div className="mt-8 flex flex-col gap-3">
      <article className={cn("relative rounded-3xl border bg-card px-5 pt-8 pb-6 text-center", MEDALS[0].card)}>
        <Medal place={0} className="absolute -top-4 left-1/2 size-10 -translate-x-1/2" />
        <ul className="flex flex-wrap justify-center gap-1" aria-label={first.word}>
          {tiles.map((tile, index) => (
            <TileBox key={`${tile.letter}-${index}`} tile={tile} length={tiles.length} small />
          ))}
        </ul>
        <p className="mt-5 font-mono text-4xl leading-none tabular-nums sm:text-5xl">{formatScore(first.score)}</p>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <TierBadge score={first.score} />
          <span>
            by <span className="text-foreground">{first.username}</span>
            {me === first.username ? <YouChip /> : null}
          </span>
        </p>
      </article>
      {rest.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((row, index) => (
            <article key={`${row.rank}-${row.word}`} className={cn("relative rounded-2xl border bg-card px-4 pt-6 pb-4 text-center", MEDALS[index + 1]!.card)}>
              <Medal place={index + 1} className="absolute -top-4 left-1/2 -translate-x-1/2" />
              <p className="font-display text-2xl leading-tight tracking-tight break-words italic">{row.word}</p>
              <p className="mt-2 font-mono text-xl tabular-nums">{formatScore(row.score)}</p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <TierBadge score={row.score} small />
                <span>
                  by <span className="text-foreground">{row.username}</span>
                  {me === row.username ? <YouChip /> : null}
                </span>
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TotalsPodium({ rows, me }: { rows: TotalsRow[]; me: string | null }) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:items-end">
      {rows.map((row, index) => (
        <article
          key={`${row.rank}-${row.username}`}
          className={cn(
            "relative rounded-2xl border bg-card px-4 pt-7 pb-5 text-center",
            MEDALS[index]!.card,
            index === 0 ? "sm:order-2 sm:pb-8" : index === 1 ? "sm:order-1" : "sm:order-3",
          )}
        >
          <Medal place={index} className="absolute -top-4 left-1/2 -translate-x-1/2" />
          <p className={cn("truncate text-foreground", index === 0 ? "text-xl" : "text-base")}>
            {row.username}
            {me === row.username ? <YouChip /> : null}
          </p>
          <p className={cn("mt-2 font-mono leading-none tabular-nums", index === 0 ? "text-3xl" : "text-2xl")}>{formatScore(row.score)}</p>
        </article>
      ))}
    </div>
  )
}

function rowClass(mine: boolean): string {
  return cn(
    "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
    mine ? "bg-amber-500/[0.08] ring-1 ring-amber-600/30 dark:bg-amber-200/[0.07] dark:ring-amber-200/30" : "odd:bg-card/40 hover:bg-card/80",
  )
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; scope?: string; board?: string }>
}) {
  const { view: raw, scope: rawScope, board: rawBoard } = await searchParams
  const totals = rawBoard === "totals"
  const friends = rawScope === "friends"
  const rollView = parseBoardView(raw)
  const totalsView = parseTotalsView(raw)
  const account = await currentAccount()
  const named = account?.username ? account : null
  const me = named?.username ?? null
  const db = await appDb()
  const friendCount = named && friends ? (await listFriendships(db, named.id)).friends.length : 0
  const rollRows = totals
    ? []
    : friends && named
      ? await listFriendsBoard(db, named.id, rollView)
      : friends
        ? []
        : await listBoard(db, rollView)
  const totalRows = !totals
    ? []
    : friends && named
      ? await listFriendTotals(db, named.id, totalsView)
      : friends
        ? []
        : await listTotals(db, totalsView)
  const currentRoll = ROLL_VIEWS.find((item) => item.id === rollView) ?? ROLL_VIEWS[0]!
  const currentTotal = TOTAL_VIEWS.find((item) => item.id === totalsView) ?? TOTAL_VIEWS[0]!
  const note = totals ? currentTotal.note : currentRoll.note
  const empty = totals ? currentTotal.empty : currentRoll.empty
  const rows = totals ? totalRows : rollRows
  const periodLabel = totals ? currentTotal.label : currentRoll.label
  const scoped = friends && named != null

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl">
          <div className="mt-10 text-center">
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
              {totals ? "Total score" : "Best single roll"} · {periodLabel}
            </p>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Leaderboard</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-pretty text-muted-foreground">
              {totals ? "Every roll in the period added up. " : ""}
              {friends ? "You and accepted friends. " : ""}
              {note} Top 100.
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              <Segmented
                label="Leaderboard type"
                items={[
                  { href: boardHref(false, rollView, scoped), text: "Best roll", selected: !totals },
                  { href: boardHref(true, totalsView, scoped), text: "Total score", selected: totals },
                ]}
              />
              {named ? (
                <Segmented
                  label="Who is on the leaderboard"
                  items={[
                    { href: boardHref(totals, totals ? totalsView : rollView, false), text: "Everyone", selected: !friends },
                    { href: boardHref(totals, totals ? totalsView : rollView, true), text: "Friends", selected: friends },
                  ]}
                />
              ) : null}
            </div>
            <Segmented
              label="Leaderboard period"
              items={
                totals
                  ? TOTAL_VIEWS.map((item) => ({ href: boardHref(true, item.id, scoped), text: item.label, selected: item.id === totalsView }))
                  : ROLL_VIEWS.map((item) => ({ href: boardHref(false, item.id, scoped), text: item.label, selected: item.id === rollView }))
              }
            />
          </div>

          {friends && !named ? (
            <p className="mx-auto mt-10 max-w-md text-center text-base text-muted-foreground" role="status">
              {account ? (
                <>
                  Pick a username on the{" "}
                  <Link href="/" className="text-foreground underline underline-offset-4">
                    home page
                  </Link>{" "}
                  before you open a friends leaderboard.
                </>
              ) : (
                <>
                  <LoginPrompt className="cursor-pointer text-foreground underline underline-offset-4">Log in</LoginPrompt> and
                  pick a username to open a friends leaderboard.
                </>
              )}
            </p>
          ) : null}
          {friends && named && friendCount === 0 ? (
            <p className="mx-auto mt-8 max-w-md text-center text-sm text-muted-foreground">
              No friends yet.{" "}
              <Link href="/friends" className="text-foreground underline underline-offset-4">
                Add one
              </Link>{" "}
              and they accept before their rolls show here.
            </p>
          ) : null}

          {friends && !named ? null : rows.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-border px-6 py-12 text-center" role="status">
              <p className="font-display text-3xl tracking-tight italic">Nobody yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
              <Link
                href="/"
                className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Roll a word
              </Link>
            </div>
          ) : totals ? (
            <>
              <TotalsPodium rows={totalRows.slice(0, 3)} me={me} />
              {totalRows.length > 3 ? (
                <ol className="mt-6 flex flex-col gap-1" aria-label={`${periodLabel} total score`}>
                  {totalRows.slice(3).map((row) => (
                    <li key={`${row.rank}-${row.username}`} className={rowClass(me === row.username)}>
                      <span className="text-center font-mono text-sm text-muted-foreground tabular-nums">{row.rank}</span>
                      <span className="min-w-0 truncate text-base text-foreground">
                        {row.username}
                        {me === row.username ? <YouChip /> : null}
                      </span>
                      <span className="font-mono text-sm text-foreground tabular-nums">{formatScore(row.score)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          ) : (
            <>
              <RollPodium rows={rollRows.slice(0, 3)} me={me} />
              {rollRows.length > 3 ? (
                <ol className="mt-6 flex flex-col gap-1" aria-label={`${periodLabel} leaderboard`}>
                  {rollRows.slice(3).map((row) => (
                    <li key={`${row.rank}-${row.username}-${row.word}`} className={rowClass(me === row.username)}>
                      <span className="text-center font-mono text-sm text-muted-foreground tabular-nums">{row.rank}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-xl leading-tight tracking-tight italic">{row.word}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.username}
                          {me === row.username ? <YouChip /> : null}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <span className="font-mono text-sm text-foreground tabular-nums">{formatScore(row.score)}</span>
                        <TierBadge score={row.score} small />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
