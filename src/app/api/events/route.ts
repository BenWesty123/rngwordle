import { appDb } from "@/lib/app-db"
import { bumpCounter, isClientCounter } from "@/lib/counters"
import { allowRequest, visitorKey } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** The browser reports a share or a shared-link visit. Only known names are counted; nothing about who. */
export async function POST(request: Request) {
  let name = ""
  try {
    const body = (await request.json()) as { name?: unknown }
    name = typeof body.name === "string" ? body.name : ""
  } catch {
    name = ""
  }
  if (!isClientCounter(name)) return new NextResponse(null, { status: 204 })
  // Shares the roll limiter, so a script can't inflate the numbers much.
  if (!(await allowRequest("ROLL_LIMITER", `event:${visitorKey(request)}`))) return new NextResponse(null, { status: 204 })
  try {
    await bumpCounter(await appDb(), name)
  } catch {
    // A missed count isn't worth an error for the player.
  }
  return new NextResponse(null, { status: 204 })
}
