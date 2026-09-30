import { appDb } from "@/lib/app-db"
import { formatScore, listBoard } from "@/lib/accounts"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Top row of today's best-roll board. Same ranking as the Today leaderboard. */
export async function GET() {
  try {
    const db = await appDb()
    const [top] = await listBoard(db, "today", Date.now(), 1)
    if (!top) return NextResponse.json({ top: null }, { headers: { "Cache-Control": "no-store" } })
    return NextResponse.json(
      { top: { word: top.word, username: top.username, score: formatScore(top.score) } },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ error: "Today's highest roll didn't load." }, { status: 500 })
  }
}
