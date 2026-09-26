import { cookies } from "next/headers"
import { appDb } from "@/lib/app-db"
import { accountForSession, rollForDay, SESSION_COOKIE, type SavedRoll } from "@/lib/accounts"
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
  const today = account.username ? await rollForDay(db, account.id, utcDateKey()) : null
  return { id: account.id, email: account.email, username: account.username, today }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: 60 * 60 * 24 * 30,
  }
}
