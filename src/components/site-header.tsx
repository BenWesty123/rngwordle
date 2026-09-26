"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAccount } from "@/components/account-provider"

export function SiteHeader({ trailing }: { trailing?: ReactNode }) {
  const { account, logout } = useAccount()
  const path = usePathname()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <Link href="/" className="text-sm tracking-[0.14em] text-muted-foreground">
        RWGdle
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" className="h-9 px-2.5" nativeButton={false} render={<Link href="/leaderboard" aria-current={path.startsWith("/leaderboard") ? "page" : undefined} />}>
          Board
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
          <Button variant="outline" className="h-9" nativeButton={false} render={<Link href="/login" />}>
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
