import { appDb } from "@/lib/app-db"
import { saveAnonymousRoll, saveDailyRoll, scoreDigits, SESSION_COOKIE, accountForSession } from "@/lib/accounts"
import { randomWord } from "@/lib/dictionary"
import { scoreWord } from "@/lib/scoring"
import { serverDictionary } from "@/lib/server-dictionary"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const db = await appDb()
  const account = token ? await accountForSession(db, token) : null
  const now = Date.now()
  let list: string[]
  try {
    list = await serverDictionary()
  } catch {
    return NextResponse.json({ error: "The word list didn't load." }, { status: 500 })
  }
  const draw = () => {
    const word = randomWord(list)
    return { word, score: scoreDigits(scoreWord(word).total) }
  }
  let result: Awaited<ReturnType<typeof saveDailyRoll>>
  try {
    result = account ? await saveDailyRoll(db, account.id, now, draw) : await saveAnonymousRoll(db, now, draw)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "That roll could not be saved."
    return NextResponse.json({ error: detail }, { status: 500 })
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
