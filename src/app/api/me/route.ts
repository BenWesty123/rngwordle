import { appDb } from "@/lib/app-db"
import { renewSession, SESSION_COOKIE } from "@/lib/accounts"
import { currentAccount, sessionCookieOptions } from "@/lib/current-account"
import { publicOrigin } from "@/lib/request-origin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ account: null })
  const response = NextResponse.json({
    account: {
      email: account.email,
      username: account.username,
      today: account.today
        ? { word: account.today.word, score: account.today.score, playedAt: account.today.playedAt }
        : null,
    },
  })
  // Every visit pushes the session a year out (at most once a day), so regulars stay logged in.
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token && (await renewSession(await appDb(), token))) {
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(publicOrigin(request).startsWith("https:")))
  }
  return response
}
