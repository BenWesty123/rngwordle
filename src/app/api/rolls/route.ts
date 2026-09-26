import { readFileSync } from "node:fs"
import { join } from "node:path"
import { appDb, saveDailyRoll, scoreDigits, SESSION_COOKIE, accountForSession } from "@/lib/accounts"
import { randomWord } from "@/lib/dictionary"
import { scoreWord } from "@/lib/scoring"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

let words: string[] | null = null

function dictionary(): string[] {
  if (!words) {
    const text = readFileSync(join(process.cwd(), "public", "words.txt"), "utf8")
    words = text
      .trim()
      .split(/\n/)
      .map((word) => word.trim())
      .filter((word) => /^[a-z]+$/.test(word))
    if (words.length === 0) throw new Error("Dictionary was empty")
  }
  return words
}

export async function POST() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const account = token ? accountForSession(appDb(), token) : null
  if (!account) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  let result: ReturnType<typeof saveDailyRoll>
  try {
    result = saveDailyRoll(appDb(), account.id, Date.now(), () => {
      const word = randomWord(dictionary())
      return { word, score: scoreDigits(scoreWord(word).total) }
    })
  } catch {
    return NextResponse.json({ error: "The word list didn't load." }, { status: 500 })
  }
  if ("error" in result) {
    const status = result.error === "Choose a username first." ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({
    word: result.roll.word,
    score: result.roll.score,
    playedAt: result.roll.playedAt,
    created: result.created,
  })
}
