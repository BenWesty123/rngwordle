"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type TodayRoll = {
  word: string
  score: string
  playedAt: number
}

type AccountResponse = {
  account: {
    email: string
    username: string | null
    today: TodayRoll | null
  } | null
}

export type AccountState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "guest" }
  | { status: "needs-name"; email: string; today: TodayRoll | null }
  | { status: "player"; email: string; username: string; today: TodayRoll | null }

type AccountContextValue = {
  account: AccountState
  refresh: () => Promise<void>
  logout: () => Promise<void>
  rememberToday: (roll: TodayRoll) => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

function fromResponse(body: AccountResponse): AccountState {
  if (!body.account) return { status: "guest" }
  if (!body.account.username) return { status: "needs-name", email: body.account.email, today: body.account.today }
  return {
    status: "player",
    email: body.account.email,
    username: body.account.username,
    today: body.account.today,
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountState>({ status: "loading" })

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/me")
      if (!response.ok) throw new Error("status")
      const body = (await response.json()) as AccountResponse
      setAccount(fromResponse(body))
    } catch {
      setAccount({ status: "error" })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setAccount({ status: "guest" })
  }, [])

  const rememberToday = useCallback((roll: TodayRoll) => {
    setAccount((current) =>
      current.status === "player" || current.status === "needs-name" ? { ...current, today: roll } : current,
    )
  }, [])

  const value = useMemo(
    () => ({ account, refresh, logout, rememberToday }),
    [account, refresh, logout, rememberToday],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext)
  if (!value) throw new Error("AccountProvider is missing")
  return value
}
