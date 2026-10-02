import { appDb } from "@/lib/app-db"
import {
  accountForSession,
  GUEST_COOKIE,
  listRollWords,
  newGuestSecret,
  saveDailyRoll,
  saveGuestRoll,
  scoreDigits,
  SESSION_COOKIE,
} from "@/lib/accounts"
import { newCards } from "@/lib/cards"
import { randomWord } from "@/lib/dictionary"
import { allowRequest, visitorKey } from "@/lib/rate-limit"
import { publicOrigin } from "@/lib/request-origin"
import { scoreWord } from "@/lib/scoring"
import { serverDictionary } from "@/lib/server-dictionary"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!(await allowRequest("ROLL_LIMITER", visitorKey(request)))) {
    return NextResponse.json({ error: "That's a lot of rolls. Take a breather and try again in a minute." }, { status: 429 })
  }
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

  if (!account) {
    // Guests: one leaderboard roll per browser per UTC day, then practice rolls that aren't saved.
    const existing = jar.get(GUEST_COOKIE)?.value
    const guestSecret = existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing) ? existing : newGuestSecret()
    let guest: Awaited<ReturnType<typeof saveGuestRoll>>
    try {
      guest = await saveGuestRoll(db, guestSecret, now, draw)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "That roll could not be saved."
      return NextResponse.json({ error: detail }, { status: 500 })
    }
    if ("error" in guest) return NextResponse.json({ error: guest.error }, { status: 400 })
    const response = NextResponse.json({
      word: guest.roll.word,
      score: guest.roll.score,
      playedAt: guest.roll.playedAt,
      created: guest.created,
      practice: guest.practice,
      scored: scoreWord(guest.roll.word),
    })
    if (guestSecret !== existing) {
      response.cookies.set(GUEST_COOKIE, guestSecret, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: publicOrigin(request).startsWith("https:"),
        maxAge: 365 * 24 * 60 * 60,
      })
    }
    return response
  }

  // A player's earlier rolls, so the response can say which cards this one unlocks.
  const earlier = await listRollWords(db, account.id)
  let result: Awaited<ReturnType<typeof saveDailyRoll>>
  try {
    result = await saveDailyRoll(db, account.id, now, draw)
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
    scored: scoreWord(result.roll.word),
    newCards: result.created ? newCards(result.roll.word, earlier) : [],
  })
}
