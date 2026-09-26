import { cookies } from "next/headers"
import { accountForSession, appDb, rollForDay, SESSION_COOKIE, type SavedRoll } from "@/lib/accounts"
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
  const account = accountForSession(appDb(), token)
  if (!account) return null
  const today = account.username ? rollForDay(appDb(), account.id, utcDateKey()) : null
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
