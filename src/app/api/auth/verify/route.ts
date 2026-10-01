import { appDb } from "@/lib/app-db"
import { approveLoginWaits, consumeLoginLink, isOwnLoginWait, LOGIN_WAIT_COOKIE, SESSION_COOKIE } from "@/lib/accounts"
import { sessionCookieOptions } from "@/lib/current-account"
import { publicOrigin } from "@/lib/request-origin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const token = await postedToken(request)
  const db = await appDb()
  const result = token ? await consumeLoginLink(db, token) : { error: "missing" as const }
  const origin = publicOrigin(request)
  const secure = origin.startsWith("https:")
  if ("error" in result) {
    const login = new URL("/", origin)
    login.searchParams.set("login", "1")
    login.searchParams.set("error", result.error)
    return NextResponse.redirect(login, 303)
  }
  // Log in the tab that asked for this link too. If this is that browser, it's already covered.
  const waitSecret = (await cookies()).get(LOGIN_WAIT_COOKIE)?.value
  const own = await isOwnLoginWait(db, token, waitSecret)
  await approveLoginWaits(db, token, own ? waitSecret : undefined)

  const response = NextResponse.redirect(new URL("/", origin), 303)
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(secure))
  if (own) response.cookies.delete(LOGIN_WAIT_COOKIE)
  return response
}

async function postedToken(request: Request): Promise<string> {
  const query = new URL(request.url).searchParams.get("token") ?? ""
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData()
    const value = form.get("token")
    if (typeof value === "string" && value) return value
  }
  return query
}
