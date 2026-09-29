import { SiteHeader } from "@/components/site-header"

export default function LeaderboardLoading() {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <h1 className="mt-12 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Leaderboard</h1>
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        Loading the leaderboard…
      </p>
    </div>
  )
}
