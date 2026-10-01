import { cardCatalog } from "@/lib/cards"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Details for cards this browser has found. The collection page only knows a
 * locked card's rarity, so it asks here for the ones found by rolls it remembers.
 * You need a card's id to get it, and ids only come from rolls you've made.
 */
export async function GET(request: Request) {
  const ids = new Set(
    (new URL(request.url).searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[a-z-]{1,40}$/.test(id))
      .slice(0, 120),
  )
  const cards = cardCatalog().filter((card) => ids.has(card.id))
  return NextResponse.json({ cards }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
