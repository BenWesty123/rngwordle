"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount } from "@/components/account-provider"
import { useLoginDialog } from "@/components/login-dialog"
import { Button } from "@/components/ui/button"

export function SiteHeader({ trailing }: { trailing?: ReactNode }) {
  const { account, logout } = useAccount()
  const { openLogin } = useLoginDialog()
  const path = usePathname()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Link href="/" className="group flex flex-col leading-none" aria-label="RWGdle, Random Word Generator, home">
        <span className="font-display text-2xl tracking-tight text-foreground italic transition-colors group-hover:text-amber-100">
          RWGdle
        </span>
        <span className="mt-1 text-[10px] tracking-[0.22em] text-muted-foreground uppercase">Random Word Generator</span>
      </Link>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/leaderboard" aria-current={path.startsWith("/leaderboard") ? "page" : undefined} />}>
          Leaderboard
        </Button>
        {account.status === "player" ? (
          <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/friends" aria-current={path === "/friends" ? "page" : undefined} />}>
            Friends
          </Button>
        ) : null}
        {account.status === "player" ? (
          <span className="max-w-32 truncate text-sm text-foreground">{account.username}</span>
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
        {trailing}
      </div>
    </header>
  )
}
