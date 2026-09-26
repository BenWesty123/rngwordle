import { createLoginLink, appDb } from "@/lib/accounts"
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
  const created = createLoginLink(appDb(), email)
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 })
  const link = new URL("/auth/verify", request.url)
  link.searchParams.set("token", created.token)
  return NextResponse.json({ link: link.toString() })
}
