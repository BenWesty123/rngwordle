import Link from "next/link"
import { LoginPrompt } from "@/components/login-dialog"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { formatScore, listBoard, listTotals, parseBoardView, parseTotalsView, type BoardView, type TotalsView } from "@/lib/accounts"
import { currentAccount } from "@/lib/current-account"
import { listFriendships, listFriendsBoard, listFriendTotals } from "@/lib/friends"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROLL_VIEWS: Array<{ id: BoardView; label: string; empty: string; note: string }> = [
  { id: "today", label: "Today", empty: "No saved rolls yet today.", note: "UTC day, so far." },
  { id: "week", label: "This week", empty: "No saved rolls this week.", note: "Monday 00:00 UTC through now." },
  { id: "month", label: "This month", empty: "No saved rolls this month.", note: "This calendar month, UTC." },
  { id: "all", label: "All time", empty: "No saved rolls yet.", note: "Every saved roll." },
]

const TOTAL_VIEWS: Array<{ id: TotalsView; label: string; empty: string; note: string }> = [
  { id: "week", label: "This Week", empty: "No totals this week.", note: "Monday 00:00 UTC through now." },
  { id: "month", label: "This Month", empty: "No totals this month.", note: "This calendar month, UTC." },
]

function tabClass(selected: boolean): string {
  return selected
    ? "rounded-full border border-amber-200/50 bg-amber-200/15 px-3 py-1 text-sm text-amber-100"
    : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
}

function boardHref(totals: boolean, view: string, friends: boolean): string {
  const params = new URLSearchParams()
  if (totals) params.set("board", "totals")
  if (friends) params.set("scope", "friends")
  const defaultView = totals ? "week" : "today"
  if (view !== defaultView) params.set("view", view)
  const query = params.toString()
  return query ? `/leaderboard?${query}` : "/leaderboard"
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

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <h1 className="mt-12 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Leaderboard</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        {totals ? "Total score for the period, not a single roll. " : "Best single roll. "}
        {friends ? "You and accepted friends. " : ""}
        {note} Highest first. Top 100.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard type">
        <Link href={boardHref(false, rollView, friends && named != null)} role="tab" aria-selected={!totals} className={tabClass(!totals)}>
          Best roll
        </Link>
        <Link
          href={boardHref(true, totalsView, friends && named != null)}
          role="tab"
          aria-selected={totals}
          className={tabClass(totals)}
        >
          Total score
        </Link>
      </div>
      {named ? (
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Who is on the leaderboard">
          <Link href={boardHref(totals, totals ? totalsView : rollView, false)} role="tab" aria-selected={!friends} className={tabClass(!friends)}>
            Everyone
          </Link>
          <Link href={boardHref(totals, totals ? totalsView : rollView, true)} role="tab" aria-selected={friends} className={tabClass(friends)}>
            Friends
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard period">
        {totals
          ? TOTAL_VIEWS.map((item) => (
              <Link
                key={item.id}
                href={boardHref(true, item.id, friends && named != null)}
                role="tab"
                aria-selected={item.id === totalsView}
                className={tabClass(item.id === totalsView)}
              >
                {item.label}
              </Link>
            ))
          : ROLL_VIEWS.map((item) => (
              <Link
                key={item.id}
                href={boardHref(false, item.id, friends && named != null)}
                role="tab"
                aria-selected={item.id === rollView}
                className={tabClass(item.id === rollView)}
              >
                {item.label}
              </Link>
            ))}
      </div>
      {friends && !named ? (
        <p className="mt-10 max-w-md text-base text-muted-foreground" role="status">
          {account ? (
            <>
              Pick a username on the{" "}
              <Link href="/" className="text-foreground underline-offset-4 hover:underline">
                home page
              </Link>{" "}
              before you open a friends leaderboard.
            </>
          ) : (
            <>
              <LoginPrompt className="cursor-pointer text-foreground underline-offset-4 hover:underline">
                Log in
              </LoginPrompt>{" "}
              and pick a username to open a friends leaderboard.
            </>
          )}
        </p>
      ) : null}
      {friends && named && friendCount === 0 ? (
        <p className="mt-8 max-w-md text-sm text-muted-foreground">
          No friends yet.{" "}
          <Link href="/friends" className="text-foreground underline-offset-4 hover:underline">
            Add one
          </Link>{" "}
          and they accept before their rolls show here.
        </p>
      ) : null}
      {friends && !named ? null : rows.length === 0 ? (
        <p className="mt-10 text-base text-muted-foreground" role="status">
          {empty}{" "}
          <Link href="/" className="text-foreground underline-offset-4 hover:underline">
            Generate a saved roll
          </Link>
          .
        </p>
      ) : totals ? (
        <ol className="mt-8" aria-label={`${periodLabel} total score`}>
          {totalRows.map((row) => (
            <li
              key={`${row.rank}-${row.username}`}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border py-3"
            >
              <span className="font-mono text-sm text-muted-foreground tabular-nums">{row.rank}</span>
              <span className="min-w-0 truncate text-sm text-foreground">{row.username}</span>
              <span className="font-mono text-sm text-foreground tabular-nums">{formatScore(row.score)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="mt-8" aria-label={`${periodLabel} leaderboard`}>
          {rollRows.map((row) => (
            <li
              key={`${row.rank}-${row.username}-${row.word}`}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-border py-3"
            >
              <span className="font-mono text-sm text-muted-foreground tabular-nums">{row.rank}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{row.username}</span>
                <span className="block truncate font-display text-2xl tracking-tight italic">{row.word}</span>
              </span>
              <span className="font-mono text-sm text-foreground tabular-nums">{formatScore(row.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
