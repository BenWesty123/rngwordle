import Link from "next/link"
import { notFound } from "next/navigation"
import { LeaderboardWord } from "@/components/leaderboard-word"
import { SiteHeader } from "@/components/site-header"
import { formatScore, getPlayerHistory } from "@/lib/accounts"
import { appDb } from "@/lib/app-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 30

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ username: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ username }, { page: rawPage }] = await Promise.all([params, searchParams])
  const player = await getPlayerHistory(await appDb(), username)
  if (!player) notFound()

  const requestedPage = Number(rawPage)
  const lastPage = Math.max(1, Math.ceil(player.rolls.length / PAGE_SIZE))
  const page = Number.isSafeInteger(requestedPage) ? Math.min(Math.max(1, requestedPage), lastPage) : 1
  const rolls = player.rolls.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const playerHref = `/players/${encodeURIComponent(player.username)}`

  return (
    <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl">
        <div className="mt-10 text-center">
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight break-words italic sm:text-6xl">{player.username}</h1>
          <p className="mt-3 text-sm text-muted-foreground">All-time public score</p>
          <p className="mt-1 font-mono text-3xl break-all tabular-nums">{formatScore(player.total)}</p>
        </div>
        <h2 className="mt-8 text-lg font-medium">Roll history</h2>
        {rolls.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No public rolls yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1">
            {rolls.map((roll) => (
              <li key={roll.utc_day} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 odd:bg-card/40">
                <div className="min-w-0">
                  <LeaderboardWord word={roll.word} className="block max-w-full truncate text-left font-display text-xl italic underline decoration-border underline-offset-4 hover:decoration-current" />
                  <time dateTime={roll.utc_day} className="block text-xs text-muted-foreground">{roll.utc_day} UTC</time>
                </div>
                <span className="font-mono text-sm tabular-nums">{formatScore(roll.score)}</span>
              </li>
            ))}
          </ol>
        )}
        {lastPage > 1 ? (
          <nav className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm" aria-label="Roll history pages">
            {page > 1 ? <Link className="underline underline-offset-4" href={`${playerHref}?page=${page - 1}`}>Newer rolls</Link> : null}
            <span className="text-muted-foreground">Page {page} of {lastPage}</span>
            {page < lastPage ? <Link className="underline underline-offset-4" href={`${playerHref}?page=${page + 1}`}>Older rolls</Link> : null}
          </nav>
        ) : null}
      </main>
    </div>
  )
}
