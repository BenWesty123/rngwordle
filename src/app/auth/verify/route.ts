import { consumeLoginLink, appDb, SESSION_COOKIE } from "@/lib/accounts"
import { sessionCookieOptions } from "@/lib/current-account"
import { publicOrigin } from "@/lib/request-origin"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const result = token ? consumeLoginLink(appDb(), token) : { error: "missing" as const }
  const origin = publicOrigin(request)
  const secure = origin.startsWith("https:")
  if ("error" in result) {
    const login = new URL("/login", origin)
    login.searchParams.set("error", result.error)
    return NextResponse.redirect(login)
  }
  const response = NextResponse.redirect(new URL("/", origin))
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(secure))
  return response
}
