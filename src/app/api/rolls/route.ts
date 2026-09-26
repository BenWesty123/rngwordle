import { readFileSync } from "node:fs"
import { join } from "node:path"
import { appDb } from "@/lib/app-db"
import { saveAnonymousRoll, saveDailyRoll, scoreDigits, SESSION_COOKIE, accountForSession } from "@/lib/accounts"
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
  const db = await appDb()
  const account = token ? await accountForSession(db, token) : null
  const now = Date.now()
  const draw = () => {
    const word = randomWord(dictionary())
    return { word, score: scoreDigits(scoreWord(word).total) }
  }
  let result: Awaited<ReturnType<typeof saveDailyRoll>>
  try {
    result = account ? await saveDailyRoll(db, account.id, now, draw) : await saveAnonymousRoll(db, now, draw)
  } catch {
    return NextResponse.json({ error: "The word list didn't load." }, { status: 500 })
  }
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({
    word: result.roll.word,
    score: result.roll.score,
    playedAt: result.roll.playedAt,
    created: result.created,
  })
}
