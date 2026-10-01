import { SiteHeader } from "@/components/site-header"

export default function LeaderboardLoading() {
  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.13),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl" role="status" aria-label="Loading the leaderboard">
          <div className="mt-10 text-center">
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Loading…</p>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Leaderboard</h1>
          </div>
          <div className="mt-14 h-44 animate-pulse rounded-3xl bg-card" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="h-32 animate-pulse rounded-2xl bg-card" />
            <div className="h-32 animate-pulse rounded-2xl bg-card" />
          </div>
          <div className="mt-6 flex flex-col gap-1">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-card/50" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
