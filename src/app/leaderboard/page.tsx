import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { formatScore, listBoard, parseBoardView, type BoardView } from "@/lib/accounts"
import { currentAccount } from "@/lib/current-account"
import { listFriendships, listFriendsBoard } from "@/lib/friends"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VIEWS: Array<{ id: BoardView; label: string; empty: string; note: string }> = [
  { id: "today", label: "Today", empty: "No saved rolls yet today.", note: "UTC day, so far." },
  { id: "week", label: "This week", empty: "No saved rolls this week.", note: "Monday 00:00 UTC through now." },
  { id: "month", label: "This month", empty: "No saved rolls this month.", note: "This calendar month, UTC." },
  { id: "all", label: "All time", empty: "No saved rolls yet.", note: "Every saved roll." },
]

function periodHref(view: BoardView, friends: boolean): string {
  const params = new URLSearchParams()
  if (friends) params.set("scope", "friends")
  if (view !== "today") params.set("view", view)
  const query = params.toString()
  return query ? `/leaderboard?${query}` : "/leaderboard"
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; scope?: string }>
}) {
  const { view: raw, scope: rawScope } = await searchParams
  const view = parseBoardView(raw)
  const friends = rawScope === "friends"
  const account = await currentAccount()
  const named = account?.username ? account : null
  const db = await appDb()
  const friendCount = named && friends ? (await listFriendships(db, named.id)).friends.length : 0
  const rows = friends && named ? await listFriendsBoard(db, named.id, view) : friends ? [] : await listBoard(db, view)
  const current = VIEWS.find((item) => item.id === view) ?? VIEWS[0]!

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <h1 className="mt-12 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">The board</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        {friends ? "You and accepted friends. " : ""}
        {current.note} Highest score first. Top 100.
      </p>
      {named ? (
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Who is on the board">
          <Link
            href={periodHref(view, false)}
            role="tab"
            aria-selected={!friends}
            className={
              !friends
                ? "rounded-full border border-amber-200/50 bg-amber-200/15 px-3 py-1 text-sm text-amber-100"
                : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
            }
          >
            Everyone
          </Link>
          <Link
            href={periodHref(view, true)}
            role="tab"
            aria-selected={friends}
            className={
              friends
                ? "rounded-full border border-amber-200/50 bg-amber-200/15 px-3 py-1 text-sm text-amber-100"
                : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
            }
          >
            Friends
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard period">
        {VIEWS.map((item) => {
          const selected = item.id === view
          return (
            <Link
              key={item.id}
              href={periodHref(item.id, friends && named != null)}
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? "rounded-full border border-amber-200/50 bg-amber-200/15 px-3 py-1 text-sm text-amber-100"
                  : "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>
      {friends && !named ? (
        <p className="mt-10 max-w-md text-base text-muted-foreground" role="status">
          {account ? (
            <>
              Pick a username on the{" "}
              <Link href="/" className="text-foreground underline-offset-4 hover:underline">
                home page
              </Link>{" "}
              before you open a friends board.
            </>
          ) : (
            <>
              <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
                Log in
              </Link>{" "}
              and pick a username to open a friends board.
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
          {current.empty}{" "}
          <Link href="/" className="text-foreground underline-offset-4 hover:underline">
            Generate a saved roll
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-8" aria-label={`${current.label} leaderboard`}>
          {rows.map((row) => (
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
