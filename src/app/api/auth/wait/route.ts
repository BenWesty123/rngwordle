import { appDb } from "@/lib/app-db"
import { claimLoginWait, SESSION_COOKIE } from "@/lib/accounts"
import { sessionCookieOptions } from "@/lib/current-account"
import { publicOrigin } from "@/lib/request-origin"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * The tab that asked for a login link checks in here. Once the link is tapped,
 * in any app or on any device, this tab gets its own session.
 */
export async function POST(request: Request) {
  let secret = ""
  try {
    const body = (await request.json()) as { wait?: unknown }
    secret = typeof body.wait === "string" ? body.wait : ""
  } catch {
    secret = ""
  }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(secret)) return NextResponse.json({ status: "expired" })
  const result = await claimLoginWait(await appDb(), secret)
  const response = NextResponse.json({ status: result.status }, { headers: { "Cache-Control": "no-store" } })
  if (result.status === "done" && result.sessionToken) {
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(publicOrigin(request).startsWith("https:")))
  }
  return response
}
