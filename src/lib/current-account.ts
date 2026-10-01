import { cookies } from "next/headers"
import { appDb } from "@/lib/app-db"
import { accountForSession, rollForDay, SESSION_COOKIE, SESSION_MS, type SavedRoll } from "@/lib/accounts"
import { utcDateKey } from "@/lib/day"

export type CurrentAccount = {
  id: string
  email: string
  username: string | null
  today: SavedRoll | null
}

export async function currentAccount(): Promise<CurrentAccount | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const db = await appDb()
  const account = await accountForSession(db, token)
  if (!account) return null
  const today = await rollForDay(db, account.id, utcDateKey())
  return { id: account.id, email: account.email, username: account.username, today }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: SESSION_MS / 1000,
  }
}

/** The secret a tab waits on while its login link is out. Only the tab that asked has it. */
export function loginWaitCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: 30 * 60,
  }
}
