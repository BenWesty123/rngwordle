import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SharedRoll } from "@/components/shared-roll"
import { SiteHeader } from "@/components/site-header"
import { scoreWord } from "@/lib/scoring"
import { isDictionaryWord } from "@/lib/server-dictionary"
import { formatStanding } from "@/lib/share"
import { standingFor } from "@/lib/standing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** What WhatsApp, Discord, and the rest show in the chat when the link is shared. */
export async function generateMetadata({ params }: { params: Promise<{ word: string }> }): Promise<Metadata> {
  const word = (await params).word.toLowerCase()
  if (!(await isDictionaryWord(word))) return { title: "RWGdle · Random Word Generator" }
  const scored = scoreWord(word)
  const standing = standingFor(scored.total)
  const title = `${word.toUpperCase()} scored ${scored.total.toLocaleString("en-US")} on RWGdle`
  const description = `${standing.tier.label} · ${formatStanding(standing.beaten)}. Can you do better? Roll your own random word.`
  return {
    title,
    description,
    openGraph: { title, description, url: `/s/${word}`, siteName: "RWGdle", type: "website" },
    twitter: { card: "summary", title, description },
  }
}

/** A shared roll: rwgdle.app/s/<word>. Shows the word and invites the visitor to roll their own. */
export default async function SharedRollPage({ params }: { params: Promise<{ word: string }> }) {
  const word = (await params).word.toLowerCase()
  if (!(await isDictionaryWord(word))) notFound()

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <SharedRoll word={word} />
      </div>
    </div>
  )
}
