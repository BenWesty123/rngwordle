"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount } from "@/components/account-provider"
import { useLoginDialog } from "@/components/login-dialog"
import { PlayerLink } from "@/components/player-link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  const { account, logout } = useAccount()
  const { openLogin } = useLoginDialog()
  const path = usePathname()
  return (
    // Title centred on the page. Wide screens put the buttons to its right; narrower ones stack them underneath.
    <header className="flex flex-col items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-4">
      <Link href="/" className="group flex flex-col items-center text-center leading-none lg:col-start-2" aria-label="RWGdle, Random Word Generator, home">
        <span className="font-display text-2xl tracking-tight text-foreground italic transition-colors group-hover:text-primary">
          RWGdle
        </span>
        <span className="mt-1 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Random Word Generator</span>
      </Link>
      <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end lg:justify-self-end">
        <NextWordCountdown />
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
          <ThemeToggle />
          <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/leaderboard" aria-current={path.startsWith("/leaderboard") ? "page" : undefined} />}>
            Leaderboard
          </Button>
          <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/cards" aria-current={path === "/cards" ? "page" : undefined} />}>
            Cards
          </Button>
          {account.status === "player" ? (
            <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/friends" aria-current={path === "/friends" ? "page" : undefined} />}>
              Friends
            </Button>
          ) : null}
          {account.status === "player" ? (
            <PlayerLink username={account.username} className="max-w-32 truncate text-sm text-foreground" />
          ) : null}
          {account.status === "guest" || account.status === "error" ? (
            <Button variant="outline" className="h-9" type="button" onClick={() => openLogin()}>
              Log in
            </Button>
          ) : null}
          {account.status === "player" || account.status === "needs-name" ? (
            <Button variant="ghost" className="h-9 px-2.5" type="button" onClick={() => void logout()}>
              Log out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function subscribeMinute(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 30_000)
  return () => window.clearInterval(id)
}

function minutesUntilNextWord(): number {
  const now = Date.now()
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return Math.ceil((next.getTime() - now) / 60_000)
}

function NextWordCountdown() {
  const minutes = useSyncExternalStore(subscribeMinute, minutesUntilNextWord, () => null)
  if (minutes === null) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const label = hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
  return (
    <span className="shrink-0 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
      Next word in {label}
    </span>
  )
}
