import { appDb } from "@/lib/app-db"
import { createLoginLink, deleteLoginLink, loginLinkSentRecently, normalizeEmail } from "@/lib/accounts"
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
  if (await loginLinkSentRecently(db, normalized)) {
    return NextResponse.json(inCloudflareWorker() ? { ok: true } : { ok: true, dev: true })
  }

  const created = await createLoginLink(db, normalized)
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 })

  const link = new URL("/auth/verify", publicOrigin(request))
  link.searchParams.set("token", created.token)
  const message = loginEmail({ to: normalized, url: link.toString() })

  if (!inCloudflareWorker()) {
    console.info(`Local login link for ${normalized} (not emailed): ${link.toString()}`)
    return NextResponse.json({ ok: true, dev: true })
  }

  try {
    await sendLoginEmail(message)
  } catch {
    await deleteLoginLink(db, created.token).catch(() => undefined)
    console.error("Login email failed")
    return NextResponse.json({ error: "The login email could not be sent." }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
