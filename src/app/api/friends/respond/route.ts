import { appDb } from "@/lib/app-db"
import { SESSION_COOKIE, accountForSession } from "@/lib/accounts"
import { acceptFriend, cancelFriend, declineFriend, removeFriend } from "@/lib/friends"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const actions = {
  accept: acceptFriend,
  decline: declineFriend,
  cancel: cancelFriend,
  remove: removeFriend,
} as const

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const db = await appDb()
  const account = token ? await accountForSession(db, token) : null
  if (!account) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  if (!account.username) return NextResponse.json({ error: "Pick a username first." }, { status: 403 })
  let id = ""
  let action = ""
  try {
    const body = (await request.json()) as { id?: unknown; action?: unknown }
    id = typeof body.id === "string" ? body.id : ""
    action = typeof body.action === "string" ? body.action : ""
  } catch {
    return NextResponse.json({ error: "That request is not yours." }, { status: 400 })
  }
  const run = actions[action as keyof typeof actions]
  if (!run || !id) return NextResponse.json({ error: "That request is not yours." }, { status: 400 })
  const result = await run(db, account.id, id)
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
