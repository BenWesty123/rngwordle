import { isBlockedWord } from "@/lib/blocked"
import { cachedJson } from "@/lib/edge-cache"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * One word's full breakdown. The scorer and its word data stay on the server.
 * Each word is kept for an hour per Cloudflare location, and the scorer is only
 * loaded on a miss, so a repeat lookup on a fresh Worker skips the word data entirely.
 */
export async function GET(request: Request) {
  const word = (new URL(request.url).searchParams.get("word") ?? "").toLowerCase()
  if (!/^[a-z]{1,40}$/.test(word) || isBlockedWord(word)) {
    return NextResponse.json({ error: "That isn't a word to score." }, { status: 400 })
  }
  const scored = await cachedJson(`score:${word}`, 3600, async () => (await import("@/lib/scoring")).scoreWord(word))
  return NextResponse.json({ scored }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
