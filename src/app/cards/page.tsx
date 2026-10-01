import type { Metadata } from "next"
import { CardBook, type SavedFinds } from "@/components/card-book"
import { SiteHeader } from "@/components/site-header"
import { listRollWords } from "@/lib/accounts"
import { appDb } from "@/lib/app-db"
import { cardCatalog, cardsInWord } from "@/lib/cards"
import { currentAccount } from "@/lib/current-account"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Card collection · RWGdle" }

export default async function CardsPage() {
  const account = await currentAccount()
  const saved: SavedFinds = {}
  let rollCount = 0
  if (account) {
    const words = await listRollWords(await appDb(), account.id)
    rollCount = words.length
    for (const word of words) {
      for (const id of cardsInWord(word)) {
        const entry = saved[id]
        if (entry) entry.count += 1
        else saved[id] = { first: word, count: 1 }
      }
    }
  }

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <CardBook catalog={cardCatalog()} saved={saved} rollCount={rollCount} signedIn={account !== null} />
      </div>
    </div>
  )
}
