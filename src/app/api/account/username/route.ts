import { appDb, setUsername, SESSION_COOKIE, accountForSession } from "@/lib/accounts"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const account = token ? accountForSession(appDb(), token) : null
  if (!account) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  let username = ""
  try {
    const body = (await request.json()) as { username?: unknown }
    username = typeof body.username === "string" ? body.username : ""
  } catch {
    return NextResponse.json({ error: "Use 3 to 20 letters, numbers, or underscores." }, { status: 400 })
  }
  const result = setUsername(appDb(), account.id, username)
  if ("error" in result) {
    const status = result.error === "That name is taken." ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ username: result.username })
}
