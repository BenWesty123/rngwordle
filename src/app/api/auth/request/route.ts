import { appDb } from "@/lib/app-db"
import {
  createLoginLink,
  createLoginWait,
  deleteLoginLink,
  describeDevice,
  LOGIN_RESEND_MS,
  LOGIN_WAIT_COOKIE,
  loginResendWait,
  normalizeEmail,
} from "@/lib/accounts"
import { loginWaitCookieOptions } from "@/lib/current-account"
import { loginEmail, sendLoginEmail } from "@/lib/login-mail"
import { publicOrigin } from "@/lib/request-origin"
import { inCloudflareWorker } from "@/lib/runtime"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let email = ""
  try {
    const body = (await request.json()) as { email?: unknown }
    email = typeof body.email === "string" ? body.email : ""
  } catch {
    return NextResponse.json({ error: "Enter an email address." }, { status: 400 })
  }
  const normalized = normalizeEmail(email)
  if (!normalized) return NextResponse.json({ error: "Enter an email address." }, { status: 400 })

  const db = await appDb()
  const wait = await loginResendWait(db, normalized)
  if (wait > 0) {
    return NextResponse.json({ ok: true, limited: true, retryAfter: Math.ceil(wait / 1000) })
  }

  const created = await createLoginLink(db, normalized)
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 })
  // This tab waits for the link to be tapped, wherever that happens.
  const waitSecret = await createLoginWait(db, created.token, describeDevice(request.headers.get("user-agent")))

  const origin = publicOrigin(request)
  // Tokens are base64url, so they sit in the path as they are.
  const link = new URL(`/login/${created.token}`, origin)
  const message = loginEmail({ to: normalized, url: link.toString() })
  const retryAfter = Math.ceil(LOGIN_RESEND_MS / 1000)

  let dev = false
  if (!inCloudflareWorker()) {
    console.info(`Local login link for ${normalized} (not emailed): ${link.toString()}`)
    dev = true
  } else {
    try {
      await sendLoginEmail(message)
    } catch {
      await deleteLoginLink(db, created.token).catch(() => undefined)
      console.error("Login email failed")
      return NextResponse.json({ error: "The login email could not be sent." }, { status: 502 })
    }
  }
  const response = NextResponse.json({ ok: true, dev, wait: waitSecret, retryAfter })
  response.cookies.set(LOGIN_WAIT_COOKIE, waitSecret, loginWaitCookieOptions(origin.startsWith("https:")))
  return response
}
