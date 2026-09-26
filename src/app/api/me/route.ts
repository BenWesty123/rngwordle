import { currentAccount } from "@/lib/current-account"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ account: null })
  return NextResponse.json({
    account: {
      email: account.email,
      username: account.username,
      today: account.today
        ? { word: account.today.word, score: account.today.score, playedAt: account.today.playedAt }
        : null,
    },
  })
}
