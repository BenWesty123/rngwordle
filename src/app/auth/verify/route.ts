import { consumeLoginLink, appDb, SESSION_COOKIE } from "@/lib/accounts"
import { sessionCookieOptions } from "@/lib/current-account"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const result = token ? consumeLoginLink(appDb(), token) : { error: "missing" as const }
  const secure = new URL(request.url).protocol === "https:"
  if ("error" in result) {
    const login = new URL("/login", request.url)
    login.searchParams.set("error", result.error)
    return NextResponse.redirect(login)
  }
  const next = new URL("/", request.url)
  const response = NextResponse.redirect(next)
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(secure))
  return response
}
