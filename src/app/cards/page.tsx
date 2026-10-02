import type { Metadata } from "next"
import { CardBook, type SavedFinds } from "@/components/card-book"
import { SiteHeader } from "@/components/site-header"
import { listRollWords } from "@/lib/accounts"
import { appDb } from "@/lib/app-db"
import { isBlockedWord } from "@/lib/blocked"
import { cardKey } from "@/lib/card-key"
import { cardCatalog, catalogEntry, cardsInWord } from "@/lib/cards"
import { currentAccount } from "@/lib/current-account"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Card collection · RWGdle" }

export default async function CardsPage() {
  const account = await currentAccount()
  const found = new Map<string, { first: string; count: number }>()
  let rollCount = 0
  if (account) {
    const words = await listRollWords(await appDb(), account.id)
    rollCount = words.length
    for (const word of words) {
      for (const id of cardsInWord(word)) {
        const entry = found.get(id)
        if (entry) entry.count += 1
        // A roll from before the blocklist keeps its cards but never shows the word.
        else found.set(id, { first: isBlockedWord(word) ? "an older roll" : word, count: 1 })
      }
    }
  }
  // Only found cards go to the browser with their details; the rest stay locked.
  const entries = cardCatalog().map((card) => catalogEntry(card, found.has(card.id)))
  const saved: SavedFinds = Object.fromEntries([...found].map(([id, info]) => [cardKey(id), info]))

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <CardBook entries={entries} saved={saved} rollCount={rollCount} signedIn={account !== null} />
      </div>
    </div>
  )
}
