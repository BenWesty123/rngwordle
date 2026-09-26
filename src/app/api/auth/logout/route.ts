import { appDb } from "@/lib/app-db"
import { deleteSession, SESSION_COOKIE } from "@/lib/accounts"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(await appDb(), token)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return response
}
