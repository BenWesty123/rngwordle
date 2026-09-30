import { scoreWord } from "@/lib/scoring"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** One word's full breakdown. The scorer and its word data stay on the server. */
export async function GET(request: Request) {
  const word = (new URL(request.url).searchParams.get("word") ?? "").toLowerCase()
  if (!/^[a-z]{1,40}$/.test(word)) {
    return NextResponse.json({ error: "That isn't a word to score." }, { status: 400 })
  }
  return NextResponse.json(
    { scored: scoreWord(word) },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  )
}
