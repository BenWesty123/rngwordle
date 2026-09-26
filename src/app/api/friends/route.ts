import { appDb } from "@/lib/app-db"
import { SESSION_COOKIE, accountForSession } from "@/lib/accounts"
import { requestFriend } from "@/lib/friends"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const db = await appDb()
  const account = token ? await accountForSession(db, token) : null
  if (!account) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  if (!account.username) return NextResponse.json({ error: "Pick a username first." }, { status: 403 })
  let username = ""
  try {
    const body = (await request.json()) as { username?: unknown }
    username = typeof body.username === "string" ? body.username : ""
  } catch {
    return NextResponse.json({ error: "No player has that username." }, { status: 400 })
  }
  const result = await requestFriend(db, account.id, username)
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ id: result.id, username: result.username })
}
